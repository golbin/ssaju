import type {
  FourPillarsDetail,
  NormalizedBirth,
  NormalizedInput,
  CalendarType,
  SajuInput,
} from "./types.ts";
import {
  BASE_KST_OFFSET_MINUTES,
  DAY_IN_MS,
  EARTHLY_BRANCHES_KO,
  HANJA_TO_KO_BRANCH,
  HEAVENLY_STEMS_KO,
  KOREA_DST_PERIODS,
  KOREA_TIMEZONE,
  KO_TO_HANJA_BRANCH,
  KO_TO_HANJA_STEM,
  LUNAR_DATA,
  MAJOR_SOLAR_TERM_APPROX_DAY_OF_YEAR,
  MAJOR_SOLAR_TERM_DEGREES,
  MAX_SUPPORTED_YEAR,
  MIN_SUPPORTED_YEAR,
  MONTH_BRANCHES,
  YEAR_STEM_TO_MONTH_START_STEM_INDEX,
  SEOUL_LONGITUDE,
  STANDARD_LONGITUDE,
  mod,
} from "./constants.ts";

// =============================
// Input/Time Normalization
// =============================

export function normalizeInput(input: SajuInput): NormalizedInput {
  const now = input.now === undefined ? undefined : new Date(input.now);
  return {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour ?? 12,
    minute: input.minute ?? 0,
    gender: input.gender ?? "여",
    calendar: input.calendar ?? "solar",
    leap: input.leap ?? false,
    timezone: input.timezone ?? KOREA_TIMEZONE,
    longitude: input.longitude,
    applyLocalMeanTime: input.applyLocalMeanTime ?? false,
    now,
  };
}

export function validateInput(input: NormalizedInput) {
  if (input.gender !== "남" && input.gender !== "여") {
    throw new Error("gender must be '남' or '여'");
  }
  if (input.calendar !== "solar" && input.calendar !== "lunar") {
    throw new Error("calendar must be 'solar' or 'lunar'");
  }
  if (!isValidTimeZone(input.timezone)) {
    throw new Error("timezone must be a valid IANA timezone string");
  }
  if (input.now && Number.isNaN(input.now.getTime())) {
    throw new Error("now must be a valid Date");
  }
  if (!Number.isInteger(input.year) || input.year < MIN_SUPPORTED_YEAR || input.year > MAX_SUPPORTED_YEAR) {
    throw new Error(`year must be an integer between ${MIN_SUPPORTED_YEAR} and ${MAX_SUPPORTED_YEAR}`);
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error("month must be an integer between 1 and 12");
  }
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) {
    throw new Error("day must be an integer between 1 and 31");
  }
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("hour must be an integer between 0 and 23");
  }
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) {
    throw new Error("minute must be an integer between 0 and 59");
  }
  if (
    typeof input.longitude === "number" &&
    (Number.isNaN(input.longitude) || input.longitude < -180 || input.longitude > 180)
  ) {
    throw new Error("longitude must be between -180 and 180");
  }
  if (input.calendar === "solar" && !isValidSolarDate(input.year, input.month, input.day)) {
    throw new Error("invalid solar date");
  }
}

function isValidSolarDate(year: number, month: number, day: number): boolean {
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month && dt.getUTCDate() === day;
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    getTimeZoneFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function normalizeBirthDate(args: {
  calendar: CalendarType;
  leap: boolean;
  timezone: string;
  longitude?: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  applyLocalMeanTime: boolean;
}): NormalizedBirth {
  const { calendar, leap, timezone, year, month, day, hour, minute, longitude, applyLocalMeanTime } = args;

  let solar = { year, month, day };
  if (calendar === "lunar") {
    solar = lunarToSolar(year, month, day, leap);
  }

  const utcDate = zonedTimeToUtc(
    { year: solar.year, month: solar.month, day: solar.day, hour, minute },
    timezone,
  );
  const kst = formatInTimeZone(utcDate, KOREA_TIMEZONE);

  const standardLongitude = getTimezoneStandardLongitude(timezone, utcDate);
  const resolvedLongitude =
    typeof longitude === "number" && !Number.isNaN(longitude)
      ? longitude
      : timezone === KOREA_TIMEZONE
      ? SEOUL_LONGITUDE
      : standardLongitude;

  const lmt = applyLocalMeanTime
    ? applyLocalMeanTimeByLongitude(
        {
          year: kst.year,
          month: kst.month,
          day: kst.day,
          hour: kst.hour,
          minute: kst.minute,
        },
        resolvedLongitude,
        standardLongitude,
      )
    : undefined;

  const calculation = lmt
    ? { year: lmt.year, month: lmt.month, day: lmt.day, hour: lmt.hour, minute: lmt.minute }
    : { year: kst.year, month: kst.month, day: kst.day, hour: kst.hour, minute: kst.minute };

  return {
    solar,
    kst: { year: kst.year, month: kst.month, day: kst.day, hour: kst.hour, minute: kst.minute },
    calculation,
    localMeanTime: lmt
      ? {
          year: lmt.year,
          month: lmt.month,
          day: lmt.day,
          hour: lmt.hour,
          minute: lmt.minute,
          longitude: resolvedLongitude,
          offsetMinutes: (resolvedLongitude - standardLongitude) * 4,
          standardLongitude,
        }
      : undefined,
  };
}

function applyLocalMeanTimeByLongitude(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  longitude: number,
  standardLongitude: number,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const offsetMinutes = (longitude - standardLongitude) * 4;
  const kstOffsetMillis = BASE_KST_OFFSET_MINUTES * 60 * 1000;
  const utcMillis = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - kstOffsetMillis;
  const adjustedKst = new Date(utcMillis + offsetMinutes * 60 * 1000 + kstOffsetMillis);

  return {
    year: adjustedKst.getUTCFullYear(),
    month: adjustedKst.getUTCMonth() + 1,
    day: adjustedKst.getUTCDate(),
    hour: adjustedKst.getUTCHours(),
    minute: adjustedKst.getUTCMinutes(),
  };
}

function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  const localMillis = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  let guess = new Date(localMillis);

  for (let i = 0; i < 5; i++) {
    const offset = getTimeZoneOffset(guess, timeZone);
    const candidate = new Date(localMillis - offset * 60 * 1000);
    if (Math.abs(candidate.getTime() - guess.getTime()) < 1000) {
      guess = candidate;
      break;
    }
    guess = candidate;
  }

  return guess;
}

const TIMEZONE_DATE_PART_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  hour12: false,
};

const timezoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = timezoneFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    ...TIMEZONE_DATE_PART_OPTIONS,
    timeZone,
  });
  timezoneFormatterCache.set(timeZone, formatter);
  return formatter;
}

function getDateTimePartsInTimeZone(date: Date, timeZone: string) {
  const parts = getTimeZoneFormatter(timeZone).formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    values[part.type] = parseInt(part.value, 10);
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function formatInTimeZone(date: Date, timeZone: string) {
  return getDateTimePartsInTimeZone(date, timeZone);
}

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const map = getDateTimePartsInTimeZone(date, timeZone);
  const asUTC = Date.UTC(
    map.year,
    (map.month || 1) - 1,
    map.day || 1,
    map.hour || 0,
    map.minute || 0,
    map.second || 0,
  );
  return (asUTC - date.getTime()) / (60 * 1000);
}

function getTimezoneStandardLongitude(timeZone: string, referenceDate: Date): number {
  if (timeZone === KOREA_TIMEZONE) return STANDARD_LONGITUDE;
  const year = referenceDate.getUTCFullYear();
  const january = new Date(Date.UTC(year, 0, 1));
  const july = new Date(Date.UTC(year, 6, 1));
  const janOffset = getTimeZoneOffset(january, timeZone);
  const julOffset = getTimeZoneOffset(july, timeZone);
  const standardOffset = Math.min(janOffset, julOffset);
  return standardOffset / 4;
}

export function getKstNowYear(reference?: Date): number {
  const now = reference ? new Date(reference) : new Date();
  return formatInTimeZone(now, KOREA_TIMEZONE).year;
}

// =============================
// Lunar/Solar Conversion
// =============================

function getLunarYearDays(year: number): number {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += LUNAR_DATA[year - 1900] & i ? 1 : 0;
  }
  return sum + getLeapMonthDays(year);
}

function getLeapMonth(year: number): number {
  return LUNAR_DATA[year - 1900] & 0xf;
}

function getLeapMonthDays(year: number): number {
  const leapMonth = getLeapMonth(year);
  if (!leapMonth) return 0;
  return LUNAR_DATA[year - 1900] & 0x10000 ? 30 : 29;
}

function getLunarMonthDays(year: number, month: number): number {
  return LUNAR_DATA[year - 1900] & (0x10000 >> month) ? 30 : 29;
}

export function lunarToSolar(year: number, month: number, day: number, isLeapMonth: boolean): {
  year: number;
  month: number;
  day: number;
} {
  if (year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) {
    throw new Error(`lunar year must be between ${MIN_SUPPORTED_YEAR} and ${MAX_SUPPORTED_YEAR}`);
  }
  if (month < 1 || month > 12) {
    throw new Error("lunar month must be between 1 and 12");
  }
  if (day < 1 || day > 30) {
    throw new Error("lunar day must be between 1 and 30");
  }

  const yearLeapMonth = getLeapMonth(year);
  if (isLeapMonth && yearLeapMonth !== month) {
    throw new Error(`lunar leap month mismatch: year ${year} leap month is ${yearLeapMonth || "none"}`);
  }

  const maxDays = isLeapMonth ? getLeapMonthDays(year) : getLunarMonthDays(year, month);
  if (day > maxDays) {
    throw new Error(`invalid lunar day: ${year}-${month}${isLeapMonth ? " (leap)" : ""} has at most ${maxDays} days`);
  }

  const baseDateMs = Date.UTC(1900, 0, 31);
  let offset = 0;

  for (let i = 1900; i < year; i++) {
    offset += getLunarYearDays(i);
  }

  const leapMonth = yearLeapMonth;
  let isLeap = false;

  for (let i = 1; i < month; i++) {
    if (leapMonth > 0 && i === leapMonth && !isLeap) {
      offset += getLeapMonthDays(year);
      isLeap = true;
      i--;
    } else {
      offset += getLunarMonthDays(year, i);
    }
  }

  if (isLeapMonth && leapMonth === month) {
    offset += getLunarMonthDays(year, month);
  }

  offset += day - 1;

  const solarDate = new Date(baseDateMs + offset * DAY_IN_MS);
  return {
    year: solarDate.getUTCFullYear(),
    month: solarDate.getUTCMonth() + 1,
    day: solarDate.getUTCDate(),
  };
}

export function solarToLunar(year: number, month: number, day: number): {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
} {
  if (year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) {
    throw new Error(`solar year must be between ${MIN_SUPPORTED_YEAR} and ${MAX_SUPPORTED_YEAR}`);
  }
  if (month < 1 || month > 12) {
    throw new Error("solar month must be between 1 and 12");
  }
  if (day < 1 || day > 31) {
    throw new Error("solar day must be between 1 and 31");
  }
  if (!isValidSolarDate(year, month, day)) {
    throw new Error("invalid solar date");
  }

  const baseDateMs = Date.UTC(1900, 0, 31);
  const targetDateMs = Date.UTC(year, month - 1, day);
  const offset = Math.floor((targetDateMs - baseDateMs) / DAY_IN_MS);

  let lunarYear = 1900;
  let remainingDays = offset;

  for (let i = 1900; i < 2100 && remainingDays > 0; i++) {
    const yearDays = getLunarYearDays(i);
    if (remainingDays < yearDays) {
      lunarYear = i;
      break;
    }
    remainingDays -= yearDays;
  }

  const leapMonth = getLeapMonth(lunarYear);
  let lunarMonth = 1;
  let isLeapMonth = false;

  for (let i = 1; i <= 12 && remainingDays > 0; i++) {
    let monthDays: number;

    if (leapMonth > 0 && i === leapMonth + 1 && !isLeapMonth) {
      monthDays = getLeapMonthDays(lunarYear);
      isLeapMonth = true;
      i--;
    } else {
      monthDays = getLunarMonthDays(lunarYear, i);
      isLeapMonth = false;
    }

    if (remainingDays < monthDays) {
      lunarMonth = i;
      break;
    }
    remainingDays -= monthDays;
  }

  return {
    year: lunarYear,
    month: lunarMonth,
    day: remainingDays + 1,
    isLeapMonth,
  };
}

// =============================
// Solar Term / 4 Pillars Core
// =============================

function compareLocal(
  a: { year: number; month: number; day: number; hour: number; minute: number },
  b: { year: number; month: number; day: number; hour: number; minute: number },
): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  return a.minute - b.minute;
}

function isDuringKoreaDST(local: { year: number; month: number; day: number; hour: number; minute: number }): boolean {
  return KOREA_DST_PERIODS.some(({ start, end }) => compareLocal(local, start) >= 0 && compareLocal(local, end) < 0);
}

export function toUTCFromKoreanLocal(year: number, month: number, day: number, hour: number, minute: number): Date {
  const local = { year, month, day, hour, minute };
  const dstOffsetMinutes = isDuringKoreaDST(local) ? 60 : 0;
  const totalOffsetMinutes = BASE_KST_OFFSET_MINUTES + dstOffsetMinutes;
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - totalOffsetMinutes * 60 * 1000;
  return new Date(utcMillis);
}

function getJulianDay(date: Date): number {
  return date.getTime() / DAY_IN_MS + 2440587.5;
}

function getSolarLongitude(date: Date): number {
  const JD = getJulianDay(date);
  const T = (JD - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T - 0.00000048 * T * T * T;
  const Mrad = (M * Math.PI) / 180;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);
  const trueLongitude = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLongitude - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180);
  return mod(lambda, 360);
}

function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

const preciseTermCache = new Map<string, Date>();

function findSolarTermUTC(year: number, targetDegree: number, approxDayOfYear: number): Date {
  const cacheKey = `${year}:${targetDegree}`;
  const cached = preciseTermCache.get(cacheKey);
  if (cached) return new Date(cached.getTime());

  const startOfYear = Date.UTC(year, 0, 1);
  let current = new Date(startOfYear + approxDayOfYear * DAY_IN_MS);

  for (let i = 0; i < 15; i++) {
    const longitude = getSolarLongitude(current);
    const diff = normalizeAngle(targetDegree - longitude);
    if (Math.abs(diff) < 1e-6) break;
    const deltaDays = (diff / 360) * 365.2422;
    current = new Date(current.getTime() + deltaDays * DAY_IN_MS);
  }

  preciseTermCache.set(cacheKey, current);
  return new Date(current.getTime());
}

function buildMajorSolarTermsUTC(year: number): Date[] {
  const out: Date[] = [];
  for (const degree of MAJOR_SOLAR_TERM_DEGREES) {
    const approxDay = MAJOR_SOLAR_TERM_APPROX_DAY_OF_YEAR[degree] ?? 35.85;
    out.push(findSolarTermUTC(year, degree, approxDay));
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
}

export function resolveNearestMajorSolarTermUTC(
  birthUtc: Date,
  forward: boolean,
): Date {
  const birthYear = birthUtc.getUTCFullYear();
  const candidates: Date[] = [];

  for (let y = birthYear - 1; y <= birthYear + 2; y++) {
    candidates.push(...buildMajorSolarTermsUTC(y));
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());

  if (forward) {
    for (const term of candidates) {
      if (term.getTime() > birthUtc.getTime()) return term;
    }
  } else {
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (candidates[i].getTime() <= birthUtc.getTime()) return candidates[i];
    }
  }

  return candidates[Math.floor(candidates.length / 2)] ?? new Date(birthUtc);
}

const lichunCache = new Map<number, Date>();

function getLichunUTCDate(year: number): Date {
  const cached = lichunCache.get(year);
  if (cached) return new Date(cached.getTime());

  const found = findSolarTermUTC(year, 315, MAJOR_SOLAR_TERM_APPROX_DAY_OF_YEAR[315]);
  lichunCache.set(year, found);
  return new Date(found.getTime());
}

function getAdjustedYearByLichun(year: number, month: number, day: number, hour: number, minute: number): number {
  const inputUTC = toUTCFromKoreanLocal(year, month, day, hour, minute);
  const lichunUTC = getLichunUTCDate(year);
  return inputUTC.getTime() < lichunUTC.getTime() ? year - 1 : year;
}

function getSolarMonthIndex(year: number, month: number, day: number, hour: number, minute: number): number {
  const inputUTC = toUTCFromKoreanLocal(year, month, day, hour, minute);
  const longitude = getSolarLongitude(inputUTC);
  const normalized = mod(longitude - 315, 360);
  return Math.floor(normalized / 30); // 0=寅 ... 11=丑
}

function getYearPillarByAdjustedYear(adjustedYear: number): { heavenlyStem: string; earthlyBranch: string } {
  return {
    heavenlyStem: HEAVENLY_STEMS_KO[mod(adjustedYear - 4, 10)],
    earthlyBranch: EARTHLY_BRANCHES_KO[mod(adjustedYear - 4, 12)],
  };
}

function getMonthPillarByAdjustedYear(adjustedYear: number, monthIndex: number): {
  heavenlyStem: string;
  earthlyBranch: string;
} {
  const yearStemIdx = mod(adjustedYear - 4, 10);
  const startStem = YEAR_STEM_TO_MONTH_START_STEM_INDEX[yearStemIdx];
  const monthStemIndex = mod(startStem + monthIndex, 10);
  const branch = MONTH_BRANCHES[monthIndex + 1] || "寅";

  return {
    heavenlyStem: HEAVENLY_STEMS_KO[monthStemIndex],
    earthlyBranch: HANJA_TO_KO_BRANCH[branch],
  };
}

function getDayPillar(year: number, month: number, day: number): { heavenlyStem: string; earthlyBranch: string } {
  const baseDateMs = Date.UTC(1992, 9, 24);
  const baseGanjiNum = 9;
  const targetDateMs = Date.UTC(year, month - 1, day);
  const daysDiff = Math.floor((targetDateMs - baseDateMs) / DAY_IN_MS);
  const targetGanjiNum = (((baseGanjiNum + daysDiff) % 60) + 60) % 60;

  return {
    heavenlyStem: HEAVENLY_STEMS_KO[targetGanjiNum % 10],
    earthlyBranch: EARTHLY_BRANCHES_KO[targetGanjiNum % 12],
  };
}

function getHourPillar(
  dayPillar: { heavenlyStem: string; earthlyBranch: string },
  hour: number,
  minute: number,
): { heavenlyStem: string; earthlyBranch: string } {
  let adjustedHour = hour;
  if (hour === 23) adjustedHour = 0;

  const totalMinutes = adjustedHour * 60 + minute;
  const shichen = Math.floor((totalMinutes + 60) / 120) % 12;

  const dayStemIndex = HEAVENLY_STEMS_KO.indexOf(dayPillar.heavenlyStem as (typeof HEAVENLY_STEMS_KO)[number]);
  const hourStemBase = (dayStemIndex % 5) * 2;
  const hourStemIndex = (hourStemBase + shichen) % 10;

  return {
    heavenlyStem: HEAVENLY_STEMS_KO[hourStemIndex],
    earthlyBranch: EARTHLY_BRANCHES_KO[shichen],
  };
}

type BirthInfo = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function calculateFourPillars(birthInfo: BirthInfo): FourPillarsDetail {
  const { hour, minute } = birthInfo;
  const { year, month, day } = birthInfo;

  const adjustedYear = getAdjustedYearByLichun(year, month, day, hour, minute);
  const monthIndex = getSolarMonthIndex(year, month, day, hour, minute);

  const yearPillar = getYearPillarByAdjustedYear(adjustedYear);
  const monthPillar = getMonthPillarByAdjustedYear(adjustedYear, monthIndex);
  const dayPillar = getDayPillar(year, month, day);
  const hourPillar = getHourPillar(dayPillar, hour, minute);

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
  };
}

// =============================
// Reference codes
// =============================

export function buildReferenceCodes(referenceDate: Date) {
  const now = formatInTimeZone(referenceDate, KOREA_TIMEZONE);
  const nextYearDate = new Date(referenceDate.getTime() + 370 * DAY_IN_MS);
  const nextMonthDate = new Date(referenceDate.getTime() + 32 * DAY_IN_MS);
  const tomorrowDate = new Date(referenceDate.getTime() + DAY_IN_MS);

  const nextYear = formatInTimeZone(nextYearDate, KOREA_TIMEZONE);
  const nextMonth = formatInTimeZone(nextMonthDate, KOREA_TIMEZONE);
  const tomorrow = formatInTimeZone(tomorrowDate, KOREA_TIMEZONE);

  const nowPillars = calculateFourPillars({
    year: now.year,
    month: now.month,
    day: now.day,
    hour: now.hour,
    minute: now.minute,
  });
  const nextYearP = calculateFourPillars({
    year: nextYear.year,
    month: nextYear.month,
    day: nextYear.day,
    hour: nextYear.hour,
    minute: nextYear.minute,
  });
  const nextMonthP = calculateFourPillars({
    year: nextMonth.year,
    month: nextMonth.month,
    day: nextMonth.day,
    hour: nextMonth.hour,
    minute: nextMonth.minute,
  });
  const tomorrowP = calculateFourPillars({
    year: tomorrow.year,
    month: tomorrow.month,
    day: tomorrow.day,
    hour: tomorrow.hour,
    minute: tomorrow.minute,
  });

  const nowLabel = `${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")} ${String(
    now.hour,
  ).padStart(2, "0")}:${String(now.minute).padStart(2, "0")} KST`;

  return {
    now: nowLabel,
    codes: {
      thisYear: `${KO_TO_HANJA_STEM[nowPillars.year.heavenlyStem]}${KO_TO_HANJA_BRANCH[nowPillars.year.earthlyBranch]}`,
      nextYear: `${KO_TO_HANJA_STEM[nextYearP.year.heavenlyStem]}${KO_TO_HANJA_BRANCH[nextYearP.year.earthlyBranch]}`,
      thisMonth: `${KO_TO_HANJA_STEM[nowPillars.month.heavenlyStem]}${KO_TO_HANJA_BRANCH[nowPillars.month.earthlyBranch]}`,
      nextMonth: `${KO_TO_HANJA_STEM[nextMonthP.month.heavenlyStem]}${KO_TO_HANJA_BRANCH[nextMonthP.month.earthlyBranch]}`,
      today: `${KO_TO_HANJA_STEM[nowPillars.day.heavenlyStem]}${KO_TO_HANJA_BRANCH[nowPillars.day.earthlyBranch]}`,
      tomorrow: `${KO_TO_HANJA_STEM[tomorrowP.day.heavenlyStem]}${KO_TO_HANJA_BRANCH[tomorrowP.day.earthlyBranch]}`,
    },
  };
}
