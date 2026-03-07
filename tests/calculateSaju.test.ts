import { test } from "node:test";
import { calculateSaju, lunarToSolar, solarToLunar } from "../index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message}\nexpected: ${e}\nactual:   ${a}`);
  }
}

test("golden case: 1992-10-24 05:30 solar", () => {
  const result = calculateSaju({
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
    now: new Date("2026-03-04T00:00:00+09:00"),
  });

  assertEquals(
    result.pillars,
    {
      year: "壬申",
      month: "庚戌",
      day: "癸酉",
      hour: "乙卯",
    },
    "golden pillars mismatch",
  );

  assert(result.dayStem === "癸", "day stem should be 癸");
  assert(result.dayBranch === "酉", "day branch should be 酉");
  assert(result.advanced.geukguk === "종왕격", "geukguk should be 종왕격");
  assertEquals(result.advanced.yongsin, ["庚", "甲", "丁"], "yongsin mismatch");
  assert(result.currentAge === 33, "currentAge should be 33 when now is 2026");
  assert(result.daeun.current?.age_range === "25", "current daeun should start at age 25");

  assertEquals(
    result.gongmang.branches,
    ["戌", "亥"],
    "gongmang branches should be 戌 and 亥 for day pillar 癸酉",
  );
  assertEquals(
    result.gongmang.branchesKo,
    ["술", "해"],
    "gongmang branchesKo should be 술 and 해",
  );
});

test("lunar input should match equivalent solar input", () => {
  const solarResult = calculateSaju({
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
  });

  const lunarResult = calculateSaju({
    year: 1992,
    month: 9,
    day: 29,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "lunar",
    leap: false,
  });

  assertEquals(
    lunarResult.solar,
    { year: 1992, month: 10, day: 24 },
    "lunar to solar conversion mismatch",
  );
  assertEquals(lunarResult.pillars, solarResult.pillars, "lunar/solar pillars should match");
});

test("hour boundary: 23:30 and 00:00 are 자시, 01:00 is 축시", () => {
  const at2330 = calculateSaju({
    year: 2024,
    month: 1,
    day: 1,
    hour: 23,
    minute: 30,
    gender: "여",
    calendar: "solar",
  });
  const at0000 = calculateSaju({
    year: 2024,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    gender: "여",
    calendar: "solar",
  });
  const at0100 = calculateSaju({
    year: 2024,
    month: 1,
    day: 1,
    hour: 1,
    minute: 0,
    gender: "여",
    calendar: "solar",
  });

  assert(at2330.pillars.hour === "甲子", "23:30 should be 甲子 hour pillar");
  assert(at0000.pillars.hour === "甲子", "00:00 should be 甲子 hour pillar");
  assert(at0100.pillars.hour === "乙丑", "01:00 should be 乙丑 hour pillar");
});

test("local mean time option should adjust calculation time and hour pillar", () => {
  const normal = calculateSaju({
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
  });

  const lmt = calculateSaju({
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
    applyLocalMeanTime: true,
    longitude: 126.9784,
  });

  assertEquals(
    lmt.normalized.calculation,
    { year: 1992, month: 10, day: 24, hour: 4, minute: 57 },
    "local mean time calculation timestamp mismatch",
  );
  assert(normal.pillars.hour === "乙卯", "baseline hour pillar should be 乙卯");
  assert(lmt.pillars.hour === "甲寅", "LMT hour pillar should be 甲寅");
});

test("result schema and text outputs should include key sections", () => {
  const result = calculateSaju({
    year: 2001,
    month: 11,
    day: 3,
    hour: 14,
    minute: 20,
    gender: "남",
    calendar: "solar",
  });

  const requiredKeys = [
    "input",
    "normalized",
    "solar",
    "pillars",
    "pillarDetails",
    "dayStem",
    "dayBranch",
    "gongmang",
    "fiveElements",
    "tenGods",
    "stages12",
    "stemRelations",
    "branchRelations",
    "sals",
    "currentAge",
    "daeun",
    "seyun",
    "wolun",
    "advanced",
    "reference",
    "toMarkdown",
    "toCompact",
  ];

  for (const key of requiredKeys) {
    assert(key in result, `missing key: ${key}`);
  }

  const markdown = result.toMarkdown();
  assert(markdown.includes("## 사주 4주"), "markdown should include 4 pillars section");
  assert(markdown.includes("## 오행 분포"), "markdown should include five elements section");
  assert(markdown.includes("## 고급 분석"), "markdown should include advanced section");
  assert(markdown.includes("## 대운"), "markdown should include daeun section");
  assert(markdown.includes("## 관계 해석 근거"), "markdown should include relation section");
  assert(markdown.includes("## 관계 강도 (우선순위)"), "markdown should include relation priority section");
  assert(markdown.includes("## 해석 시 주의 포인트 (충/형 중심)"), "markdown should include caution section");
  assert(markdown.includes("## 사주별 신살"), "markdown should include per-pillar sal section");
  assert(markdown.includes("## 계산 기준"), "markdown should include calculation basis section");
  assert(markdown.includes("## 만세력"), "markdown should include manse section");
  assert(markdown.includes("- 오늘날짜:"), "markdown should include current KST label");
  assert(markdown.includes("- 지장간:"), "markdown relation section should include hidden stems");
  assert(markdown.includes("## 지장간"), "markdown should include hidden stems table section");
  assert(markdown.includes("## 공망"), "markdown should include gongmang section");

  const compact = result.toCompact();
  assert(compact.includes("## 원국"), "compact should include pillars block");
  assert(compact.includes("## 오행"), "compact should include five elements");
  assert(compact.includes("공망"), "compact should include gongmang");
  assert(compact.includes("## 대운"), "compact should include daeun");
  assert(compact.includes("## 세운"), "compact should include seyun");
  assert(compact.includes("## 월운"), "compact should include wolun");
  assert(compact.includes("## 만세력"), "compact should include manse");
  assert(compact.includes("장간"), "compact should include hidden stems");
  assert(compact.length < markdown.length, "compact should be shorter than markdown");
});

test("lichun boundary should switch year/month pillars", () => {
  const beforeLichun = calculateSaju({
    year: 2024,
    month: 2,
    day: 3,
    hour: 12,
    minute: 0,
    gender: "남",
    calendar: "solar",
  });

  const afterLichun = calculateSaju({
    year: 2024,
    month: 2,
    day: 5,
    hour: 12,
    minute: 0,
    gender: "남",
    calendar: "solar",
  });

  assert(beforeLichun.pillars.year === "癸卯", "before lichun year pillar should be 癸卯");
  assert(afterLichun.pillars.year === "甲辰", "after lichun year pillar should be 甲辰");
  assert(beforeLichun.pillars.month === "乙丑", "before lichun month pillar should be 乙丑");
  assert(afterLichun.pillars.month === "丙寅", "after lichun month pillar should be 丙寅");
});

test("markdown should honor injected now year (deterministic output)", () => {
  const result = calculateSaju({
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
    now: new Date("2031-01-03T12:00:00+09:00"),
  });

  const markdown = result.toMarkdown();
  assert(markdown.includes("## 세운 (2031년 기준)"), "markdown seyun year title should follow injected now");
  assert(markdown.includes("## 월운 (2031년)"), "markdown wolun year title should follow injected now");
});

test("input validation should reject out-of-range values", () => {
  let threw = false;
  try {
    calculateSaju({
      year: 1800,
      month: 10,
      day: 24,
      hour: 5,
      minute: 30,
      gender: "남",
      calendar: "solar",
    });
  } catch (_err) {
    threw = true;
  }
  assert(threw, "invalid year should throw");
});

test("input validation should reject invalid enum-like values", () => {
  let invalidGenderThrew = false;
  try {
    calculateSaju({
      year: 2024,
      month: 2,
      day: 29,
      hour: 8,
      minute: 0,
      gender: "X" as unknown as "남",
      calendar: "solar",
    });
  } catch (_err) {
    invalidGenderThrew = true;
  }
  assert(invalidGenderThrew, "invalid gender should throw");

  let invalidCalendarThrew = false;
  try {
    calculateSaju({
      year: 2024,
      month: 2,
      day: 29,
      hour: 8,
      minute: 0,
      gender: "남",
      calendar: "foo" as unknown as "solar",
    });
  } catch (_err) {
    invalidCalendarThrew = true;
  }
  assert(invalidCalendarThrew, "invalid calendar should throw");
});

test("input validation should reject invalid timezone and now", () => {
  let invalidTimezoneThrew = false;
  try {
    calculateSaju({
      year: 2024,
      month: 2,
      day: 29,
      hour: 8,
      minute: 0,
      gender: "남",
      calendar: "solar",
      timezone: "Invalid/Timezone",
    });
  } catch (_err) {
    invalidTimezoneThrew = true;
  }
  assert(invalidTimezoneThrew, "invalid timezone should throw");

  let invalidNowThrew = false;
  try {
    calculateSaju({
      year: 2024,
      month: 2,
      day: 29,
      hour: 8,
      minute: 0,
      gender: "남",
      calendar: "solar",
      now: new Date("invalid"),
    });
  } catch (_err) {
    invalidNowThrew = true;
  }
  assert(invalidNowThrew, "invalid now date should throw");
});

test("invalid solar date should throw", () => {
  let threw = false;
  try {
    calculateSaju({
      year: 2024,
      month: 2,
      day: 31,
      hour: 8,
      minute: 0,
      gender: "남",
      calendar: "solar",
    });
  } catch (_err) {
    threw = true;
  }
  assert(threw, "invalid Gregorian date should throw");
});

test("direct date conversion APIs should reject invalid dates", () => {
  let solarToLunarThrew = false;
  try {
    solarToLunar(2024, 2, 31);
  } catch (_err) {
    solarToLunarThrew = true;
  }
  assert(solarToLunarThrew, "solarToLunar should reject invalid solar date");

  let leapMismatchThrew = false;
  try {
    lunarToSolar(2020, 1, 1, true);
  } catch (_err) {
    leapMismatchThrew = true;
  }
  assert(leapMismatchThrew, "lunarToSolar should reject non-leap month with leap=true");
});

test("seyun should be in ascending chronological order", () => {
  const result = calculateSaju({
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
    now: new Date("2026-03-04T00:00:00+09:00"),
  });

  for (let i = 1; i < result.seyun.length; i++) {
    assert(
      result.seyun[i].year > result.seyun[i - 1].year,
      `seyun should be ascending: ${result.seyun[i - 1].year} < ${result.seyun[i].year}`,
    );
  }
  assert(result.seyun.some((s) => s.year === 2026), "seyun should include the current year");
});

test("toCompact should contain correct pillar data", () => {
  const result = calculateSaju({
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
    now: new Date("2026-03-04T00:00:00+09:00"),
  });

  const compact = result.toCompact();
  assert(compact.includes("癸(계)수-"), "compact should contain day stem with element and yinyang");
  assert(compact.includes("酉(유)금-"), "compact should contain day branch with element and yinyang");
  assert(compact.includes("격: 종왕격"), "compact should contain geukguk");
  assert(compact.includes("공망 戌(술) 亥(해)"), "compact should contain gongmang values");
  assert(compact.includes("만 33세"), "compact should contain current age");
  assert(compact.includes("## 세운 2026 기준"), "compact seyun should reference current year");
  assert(compact.includes("★2026"), "compact seyun should mark current year");
});

test("currentAge should follow floor(day_diff/365.25): 1998-02-22 -> 28", () => {
  const result = calculateSaju({
    year: 1998,
    month: 2,
    day: 22,
    hour: 0,
    minute: 0,
    gender: "남",
    calendar: "solar",
    now: new Date("2026-03-04T00:00:00+09:00"),
  });

  assert(result.currentAge === 28, "currentAge should be 28 for 1998-02-22 at 2026-03-04 KST");
});

test("daeun should be solar-term-time based by default", () => {
  const result = calculateSaju({
    year: 1970,
    month: 1,
    day: 7,
    hour: 23,
    minute: 30,
    gender: "남",
    calendar: "solar",
  });

  assert(result.daeun.startAge >= 1, "startAge should be valid");
  assert(result.daeun.startAgePrecise > 0, "precise start age should be calculated");
  assert(result.daeun.basis.targetTermUtc.length > 0, "result should expose target solar term time");
  assert(
    result.daeun.basis.birthUtc.includes("T"),
    "birthUtc basis should be represented as ISO datetime",
  );
});
