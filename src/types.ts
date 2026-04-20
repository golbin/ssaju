export type Gender = "남" | "여";
export type CalendarType = "solar" | "lunar";

export type SajuInput = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  gender?: Gender;
  calendar?: CalendarType;
  leap?: boolean;
  timezone?: string;
  longitude?: number;
  applyLocalMeanTime?: boolean;
  now?: Date;
};

export type PillarKey = "hour" | "day" | "month" | "year";

export type PillarDetail = {
  stem: string;
  branch: string;
  stemKo: string;
  branchKo: string;
  stemIdx: number;
  branchIdx: number;
  element: { stem: string; branch: string };
  yinYang: { stem: string; branch: string };
  hiddenStems: {
    여기: string | null;
    중기: string | null;
    정기: string | null;
  };
};

export type StemRelation = {
  type: "합" | "충";
  pillars: [PillarKey, PillarKey];
  desc: string;
  stems: [string, string];
};

export type BranchRelations = {
  지장간: Partial<Record<PillarKey, string>>;
  방합: Partial<Record<PillarKey, string>>;
  삼합: Partial<Record<PillarKey, string>>;
  반합: Partial<Record<PillarKey, string>>;
  육합: Partial<Record<PillarKey, string>>;
  충: Partial<Record<PillarKey, string>>;
  형: Partial<Record<PillarKey, string>>;
  파: Partial<Record<PillarKey, string>>;
  해: Partial<Record<PillarKey, string>>;
  원진: Partial<Record<PillarKey, string>>;
  귀문: Partial<Record<PillarKey, string>>;
};

export type DaeunItem = {
  age_range: string;
  startAge: number;
  endAge: number;
  ganzhi: string;
  stem: string;
  branch: string;
  stemIdx: number;
  branchIdx: number;
  startYear: number;
  stemTenGod: string;
  branchTenGod: string;
  stage12: string;
  "12unsung": string;
  sal: string[];
};

export type SeyunItem = {
  year: number;
  ganzhi: string;
  stem: string;
  branch: string;
  tenGodStem: string;
  tenGodBranch: string;
  stage12: string;
};

export type WolunItem = {
  month: number;
  monthName: string;
  month_name: string;
  ganzhi: string;
  stem: string;
  branch: string;
  stemTenGod: string;
  stem_tengod: string;
  branchTenGod: string;
  branch_tengod: string;
  stage12: string;
  "12unsung": string;
};

export type SajuResult = {
  input: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    gender: Gender;
    calendar: CalendarType;
    leap: boolean;
    timezone: string;
    applyLocalMeanTime: boolean;
  };
  normalized: NormalizedBirth;

  solar: { year: number; month: number; day: number };
  pillars: { year: string; month: string; day: string; hour: string };
  pillarDetails: {
    year: PillarDetail;
    month: PillarDetail;
    day: PillarDetail;
    hour: PillarDetail;
  };
  dayStem: string;
  dayBranch: string;
  gongmang: { branches: [string, string]; branchesKo: [string, string] };
  fiveElements: Record<string, number>;
  tenGods: {
    year: { stem: string; branch: string };
    month: { stem: string; branch: string };
    day: { stem: string; branch: string };
    hour: { stem: string; branch: string };
  };
  stages12: {
    bong: Record<PillarKey, string>;
    geo: Record<PillarKey, string>;
  };
  stemRelations: StemRelation[];
  branchRelations: BranchRelations;
  sals: Record<PillarKey, { twelveSal: string; specialSals: string[] }>;
  currentAge: number;
  currentYear: number;
  daeun: {
    startAge: number;
    startAgePrecise: number;
    list: DaeunItem[];
    current: DaeunItem | null;
    basis: {
      direction: "forward" | "backward";
      birthUtc: string;
      targetTermUtc: string;
      diffDays: number;
    };
  };
  seyun: SeyunItem[];
  wolun: WolunItem[];

  advanced: {
    dayStrength: { strength: "strong" | "weak" | "neutral"; score: number };
    geukguk:
      | "관격"
      | "재격"
      | "인수격"
      | "식상격"
      | "비겁격"
      | "종왕격"
      | "종약격"
      | "기타";
    yongsin: string[];
    sinsal: { gilsin: string[]; hyungsin: string[] };
    interpretation: string;
  };

  reference: {
    now: string;
    codes: {
      thisYear: string;
      nextYear: string;
      thisMonth: string;
      nextMonth: string;
      today: string;
      tomorrow: string;
    };
  };

  toMarkdown: () => string;
  toCompact: () => string;
};

export type NormalizedInput = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: Gender;
  calendar: CalendarType;
  leap: boolean;
  timezone: string;
  longitude?: number;
  applyLocalMeanTime: boolean;
  now?: Date;
};

export type NormalizedBirth = {
  solar: { year: number; month: number; day: number };
  kst: { year: number; month: number; day: number; hour: number; minute: number };
  calculation: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  localMeanTime?: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    longitude: number;
    offsetMinutes: number;
    standardLongitude: number;
  };
};

export type FourPillar = { heavenlyStem: string; earthlyBranch: string };

export type FourPillarsDetail = {
  year: FourPillar;
  month: FourPillar;
  day: FourPillar;
  hour: FourPillar;
};
