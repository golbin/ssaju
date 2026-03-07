import type { BranchRelations, PillarKey, SajuResult } from "./types.ts";

const PILLAR_KEYS: PillarKey[] = ["hour", "day", "month", "year"];
const PILLAR_KO: Record<PillarKey, string> = { hour: "시주", day: "일주", month: "월주", year: "연주" };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function yinYangSign(v: string): string {
  return v === "양" ? "+" : "-";
}

function compactPillarToken(data: SajuResult, key: PillarKey, part: "stem" | "branch"): string {
  const p = data.pillarDetails[key];
  if (part === "stem") return `${p.stem}(${p.stemKo})${p.element.stem}${yinYangSign(p.yinYang.stem)}`;
  return `${p.branch}(${p.branchKo})${p.element.branch}${yinYangSign(p.yinYang.branch)}`;
}

function compactHidden(data: SajuResult, key: PillarKey): string {
  const h = data.pillarDetails[key].hiddenStems;
  return [h.여기 || "-", h.중기 || "-", h.정기 || "-"].join(",");
}

function compactRow(label: string, values: string[]): string {
  return `${label} ${values.join(" | ")}`;
}

const BRANCH_REL_KEYS = ["방합", "삼합", "반합", "육합", "충", "형", "파", "해", "원진", "귀문"] as const;

const RELATION_PRIORITY_RULES: Array<{
  key: keyof BranchRelations;
  label: string;
  weight: number;
  note: string;
}> = [
  { key: "충", label: "지지 충", weight: 5, note: "급변/충돌 가능성" },
  { key: "형", label: "지지 형", weight: 4.5, note: "긴장/소모 누적 가능성" },
  { key: "파", label: "지지 파", weight: 3.5, note: "관계 균열/계획 변동 가능성" },
  { key: "해", label: "지지 해", weight: 3, note: "오해/소통 불일치 가능성" },
  { key: "원진", label: "지지 원진", weight: 2.8, note: "감정적 피로 누적 가능성" },
  { key: "귀문", label: "지지 귀문", weight: 2.8, note: "심리적 예민/내적 갈등 가능성" },
  { key: "삼합", label: "지지 삼합", weight: 2.6, note: "기운 결집/확장 포인트" },
  { key: "방합", label: "지지 방합", weight: 2.4, note: "방향성/세력화 포인트" },
  { key: "육합", label: "지지 육합", weight: 2.2, note: "협력/완충 포인트" },
  { key: "반합", label: "지지 반합", weight: 1.8, note: "조건부 협력 포인트" },
];

type RelationPriorityItem = {
  label: string;
  score: number;
  note: string;
  detail: string;
};

function splitTokens(text: string): string[] {
  return text
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function collectRelationText(group: Record<string, string | undefined>): string {
  const uniq = new Set<string>();
  for (const raw of Object.values(group)) {
    if (!raw) continue;
    for (const token of splitTokens(raw)) {
      uniq.add(token);
    }
  }
  return Array.from(uniq).join(", ");
}

function formatHiddenStemsByPillar(data: SajuResult): string {
  return (["hour", "day", "month", "year"] as const)
    .map((k) => [PILLAR_KO[k], data.branchRelations.지장간[k]] as const)
    .filter(([, v]) => Boolean(v))
    .map(([l, v]) => `${l} ${v}`)
    .join(" / ");
}

function formatBranchRelationSummary(data: SajuResult): string {
  const pieces: string[] = [];
  for (const key of BRANCH_REL_KEYS) {
    const text = collectRelationText(data.branchRelations[key]);
    if (text) pieces.push(`${key}: ${text}`);
  }
  return pieces.join(" | ");
}

function buildRelationPriorities(data: SajuResult): RelationPriorityItem[] {
  const items: RelationPriorityItem[] = [];

  const stemChung = data.stemRelations.filter((r) => r.type === "충").map((r) => r.desc);
  if (stemChung.length) {
    items.push({
      label: "천간 충",
      score: stemChung.length * 4.8,
      note: "의사결정/대인 충돌 가능성",
      detail: stemChung.join("; "),
    });
  }

  const stemHap = data.stemRelations.filter((r) => r.type === "합").map((r) => r.desc);
  if (stemHap.length) {
    items.push({
      label: "천간 합",
      score: stemHap.length * 2,
      note: "완충/협력 가능성",
      detail: stemHap.join("; "),
    });
  }

  for (const rule of RELATION_PRIORITY_RULES) {
    const text = collectRelationText(data.branchRelations[rule.key]);
    if (!text) continue;
    const count = splitTokens(text).length;
    items.push({
      label: rule.label,
      score: rule.weight * count,
      note: rule.note,
      detail: text,
    });
  }

  items.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "ko"));
  return items;
}

function buildCautionPoints(data: SajuResult): string[] {
  const out: string[] = [];

  const stemChung = data.stemRelations.filter((r) => r.type === "충").map((r) => r.desc);
  if (stemChung.length) {
    out.push(`천간 충: ${stemChung.join("; ")} -> 의사결정과 대인 대응에서 정면충돌을 피하고 완충 장치를 두는 것이 좋습니다.`);
  }

  const branchChung = collectRelationText(data.branchRelations.충);
  if (branchChung) {
    out.push(`지지 충: ${branchChung} -> 일정 급변, 역할 충돌, 관계 긴장 국면에 대비가 필요합니다.`);
  }

  const branchHyung = collectRelationText(data.branchRelations.형);
  if (branchHyung) {
    out.push(`지지 형: ${branchHyung} -> 압박/피로 누적 구간이 생기기 쉬워 갈등 확대 전에 조정이 필요합니다.`);
  }

  const branchPa = collectRelationText(data.branchRelations.파);
  if (branchPa) {
    out.push(`지지 파: ${branchPa} -> 계획의 균열이나 기대치 차이로 인한 이탈 신호를 점검하세요.`);
  }

  if (!out.length) {
    out.push("충/형 중심의 강한 충돌 신호는 상대적으로 약합니다. 다만 시기운(세운/월운) 중복 시 재점검이 필요합니다.");
  }

  return out;
}

function countElementsByStemBranch(data: SajuResult): { stem: Record<string, number>; branch: Record<string, number> } {
  const stem: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const branch: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const k of PILLAR_KEYS) {
    const p = data.pillarDetails[k];
    if (p.element.stem) stem[p.element.stem]++;
    if (p.element.branch) branch[p.element.branch]++;
  }
  return { stem, branch };
}

export function generateMarkdownSummary(data: SajuResult): string {
  let md = "";
  const currentYear = Number(data.reference.now.slice(0, 4));
  const genderText = data.input.gender === "남" ? "남성" : "여성";
  const stemRelationText = data.stemRelations.length ? data.stemRelations.map((r) => r.desc).join("; ") : "없음";
  const hiddenByPillar = formatHiddenStemsByPillar(data);
  const branchRelationText = formatBranchRelationSummary(data);
  const relationPriorities = buildRelationPriorities(data);
  const cautionPoints = buildCautionPoints(data);
  const dayDetail = data.pillarDetails.day;

  // 4a. 기본 정보 + 일간
  md += `## 기본 정보\n`;
  md += `- 생년월일: ${data.input.year}년 ${data.input.month}월 ${data.input.day}일 ${pad2(data.input.hour)}:${pad2(data.input.minute)}\n`;
  md += `- 성별: ${genderText}\n`;
  md += `- 역법: ${data.input.calendar === "solar" ? "양력" : "음력"}\n`;
  md += `- 시간대: ${data.input.timezone}\n`;
  md += `- 일간: ${data.dayStem} (${dayDetail.stemKo}${dayDetail.element.stem}, ${dayDetail.yinYang.stem})\n\n`;

  // 4b. 사주 4주 테이블 — 천간/지지 분리 + 오행/음양
  md += `## 사주 4주 (${genderText})\n`;
  md += `| | 시주 | 일주 | 월주 | 연주 |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|\n`;
  md += `| 천간 | ${PILLAR_KEYS.map((k) => `${data.pillarDetails[k].stem}(${data.pillarDetails[k].stemKo})`).join(" | ")} |\n`;
  md += `| 오행/음양 | ${PILLAR_KEYS.map((k) => `${data.pillarDetails[k].element.stem}/${data.pillarDetails[k].yinYang.stem}`).join(" | ")} |\n`;
  md += `| 지지 | ${PILLAR_KEYS.map((k) => `${data.pillarDetails[k].branch}(${data.pillarDetails[k].branchKo})`).join(" | ")} |\n`;
  md += `| 오행/음양 | ${PILLAR_KEYS.map((k) => `${data.pillarDetails[k].element.branch}/${data.pillarDetails[k].yinYang.branch}`).join(" | ")} |\n\n`;

  // 4c. 지장간 별도 테이블
  md += `## 지장간\n`;
  md += `| 구분 | ${PILLAR_KEYS.map((k) => `${PILLAR_KO[k]}(${data.pillarDetails[k].branch})`).join(" | ")} |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|\n`;
  md += `| 여기 | ${PILLAR_KEYS.map((k) => data.pillarDetails[k].hiddenStems.여기 || "-").join(" | ")} |\n`;
  md += `| 중기 | ${PILLAR_KEYS.map((k) => data.pillarDetails[k].hiddenStems.중기 || "-").join(" | ")} |\n`;
  md += `| 정기 | ${PILLAR_KEYS.map((k) => data.pillarDetails[k].hiddenStems.정기 || "-").join(" | ")} |\n\n`;

  // 4d. 오행 분포 — 천간/지지 분리
  const elCounts = countElementsByStemBranch(data);
  md += `## 오행 분포\n`;
  md += `| 구분 | 목 | 화 | 토 | 금 | 수 |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
  md += `| 천간 | ${elCounts.stem["목"]} | ${elCounts.stem["화"]} | ${elCounts.stem["토"]} | ${elCounts.stem["금"]} | ${elCounts.stem["수"]} |\n`;
  md += `| 지지 | ${elCounts.branch["목"]} | ${elCounts.branch["화"]} | ${elCounts.branch["토"]} | ${elCounts.branch["금"]} | ${elCounts.branch["수"]} |\n`;
  md += `| 합계 | ${data.fiveElements["목"]} | ${data.fiveElements["화"]} | ${data.fiveElements["토"]} | ${data.fiveElements["금"]} | ${data.fiveElements["수"]} |\n\n`;

  md += `## 십성 & 12운성\n`;
  md += `| 구분 | 시주 | 일주 | 월주 | 연주 |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|\n`;
  md += `| 천간십성 | ${data.tenGods.hour.stem} | ${data.tenGods.day.stem} | ${data.tenGods.month.stem} | ${data.tenGods.year.stem} |\n`;
  md += `| 지지십성 | ${data.tenGods.hour.branch} | ${data.tenGods.day.branch} | ${data.tenGods.month.branch} | ${data.tenGods.year.branch} |\n`;
  md += `| 봉법12운성 | ${data.stages12.bong.hour} | ${data.stages12.bong.day} | ${data.stages12.bong.month} | ${data.stages12.bong.year} |\n`;
  md += `| 거법12운성 | ${data.stages12.geo.hour} | ${data.stages12.geo.day} | ${data.stages12.geo.month} | ${data.stages12.geo.year} |\n\n`;

  md += `## 관계 해석 근거\n`;
  md += `- 천간 관계: ${stemRelationText}\n`;
  md += `- 지장간: ${hiddenByPillar || "없음"}\n`;
  md += `- 지지 관계: ${branchRelationText || "없음"}\n\n`;

  md += `## 관계 강도 (우선순위)\n`;
  if (relationPriorities.length) {
    for (let i = 0; i < relationPriorities.length; i++) {
      const item = relationPriorities[i];
      md += `- ${i + 1}순위 ${item.label} (점수 ${item.score.toFixed(1)}): ${item.note} | ${item.detail}\n`;
    }
  } else {
    md += `- 특이 관계 신호 없음\n`;
  }
  md += "\n";

  md += `## 해석 시 주의 포인트 (충/형 중심)\n`;
  for (const point of cautionPoints) {
    md += `- ${point}\n`;
  }
  md += "\n";

  md += `## 사주별 신살\n`;
  md += `| 구분 | 시주 | 일주 | 월주 | 연주 |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|\n`;
  md += `| 12신살 | ${data.sals.hour.twelveSal} | ${data.sals.day.twelveSal} | ${data.sals.month.twelveSal} | ${data.sals.year.twelveSal} |\n`;
  md += `| 특수신살 | ${data.sals.hour.specialSals.join(", ") || "-"} | ${data.sals.day.specialSals.join(", ") || "-"} | ${data.sals.month.specialSals.join(", ") || "-"} | ${data.sals.year.specialSals.join(", ") || "-"} |\n\n`;

  // 4e. 공망 섹션
  md += `## 공망 (空亡)\n`;
  md += `- 공망: ${data.gongmang.branches[0]}(${data.gongmang.branchesKo[0]}), ${data.gongmang.branches[1]}(${data.gongmang.branchesKo[1]})\n\n`;

  md += `## 고급 분석\n`;
  const strengthLabel =
    data.advanced.dayStrength.strength === "strong"
      ? "강함"
      : data.advanced.dayStrength.strength === "weak"
      ? "약함"
      : "중화";
  md += `- 일간 강약: ${strengthLabel} (${data.advanced.dayStrength.score})\n`;
  md += `- 격국: ${data.advanced.geukguk}\n`;
  md += `- 용신: ${data.advanced.yongsin.join(", ") || "-"}\n`;
  md += `- 길신: ${data.advanced.sinsal.gilsin.join(", ") || "-"}\n`;
  md += `- 흉신: ${data.advanced.sinsal.hyungsin.join(", ") || "-"}\n\n`;

  // 4f. 대운 — 신살 컬럼 + 현재 대운 잔여
  md += `## 대운\n`;
  md += `- 시작나이: ${data.daeun.startAge}세 (정밀 ${data.daeun.startAgePrecise.toFixed(2)}세)\n`;
  if (data.daeun.current) {
    const remaining = data.daeun.current.endAge - data.currentAge;
    md += `- 현재 대운: ${data.daeun.current.ganzhi} (${data.daeun.current.startAge}세~${data.daeun.current.endAge}세, 잔여 ${remaining}년)\n`;
  }
  md += `| 대운나이 | 간지 | 천간십성 | 지지십성 | 12운성 | 신살 |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
  for (const d of data.daeun.list) {
    const marker = data.daeun.current && d.age_range === data.daeun.current.age_range ? " ★" : "";
    const salText = d.sal.length ? d.sal.join(", ") : "-";
    md += `| ${d.age_range}세${marker} | ${d.ganzhi} | ${d.stemTenGod} | ${d.branchTenGod} | ${d["12unsung"]} | ${salText} |\n`;
  }
  md += "\n";

  md += `## 세운 (${currentYear}년 기준)\n`;
  md += `| 연도 | 간지 | 천간십성 | 지지십성 | 12운성 |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|\n`;
  for (const s of data.seyun) {
    const marker = s.year === currentYear ? " ★" : "";
    md += `| ${s.year}${marker} | ${s.ganzhi} | ${s.tenGodStem} | ${s.tenGodBranch} | ${s.stage12} |\n`;
  }
  md += "\n";

  md += `## 월운 (${currentYear}년)\n`;
  md += `| 월 | 간지 | 천간십성 | 지지십성 | 12운성 |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|\n`;
  for (const w of data.wolun) {
    md += `| ${w.month_name} | ${w.ganzhi} | ${w.stem_tengod} | ${w.branch_tengod} | ${w["12unsung"]} |\n`;
  }
  md += "\n";

  md += `## 계산 기준\n`;
  if (data.normalized.localMeanTime) {
    const lmt = data.normalized.localMeanTime;
    md += `- 지역시 보정: ${lmt.year}-${pad2(lmt.month)}-${pad2(lmt.day)} ${pad2(lmt.hour)}:${pad2(lmt.minute)} (경도 ${lmt.longitude.toFixed(4)}°, ${lmt.offsetMinutes.toFixed(1)}분)\n`;
  }
  const directionKo = data.daeun.basis.direction === "forward" ? "순행" : "역행";
  md += `- 대운 기준: ${directionKo}, 절입 ${data.daeun.basis.targetTermUtc.slice(0, 16).replace("T", " ")} UTC\n\n`;

  md += `## 만세력\n`;
  md += `- 올해: ${data.reference.codes.thisYear}\n`;
  md += `- 내년: ${data.reference.codes.nextYear}\n`;
  md += `- 이번달: ${data.reference.codes.thisMonth}\n`;
  md += `- 다음달: ${data.reference.codes.nextMonth}\n`;
  md += `- 오늘: ${data.reference.codes.today}\n`;
  md += `- 내일: ${data.reference.codes.tomorrow}\n`;
  md += `- 오늘날짜: ${data.reference.now.split(" ")[0]}\n\n`;

  md += `## 해석\n`;
  md += `${data.advanced.interpretation.replace(/📑 종합 해석\n\n/, "")}\n`;

  return md;
}

export function generateCompactText(data: SajuResult): string {
  const lines: string[] = [];
  const currentYear = Number(data.reference.now.slice(0, 4));
  const dayDetail = data.pillarDetails.day;
  const pillarKeys = PILLAR_KEYS;
  const strengthChar = data.advanced.dayStrength.strength === "strong" ? "강" : data.advanced.dayStrength.strength === "weak" ? "약" : "중";

  const calendarKo = data.input.calendar === "solar" ? "양력" : "음력";

  // ## 기본
  lines.push(`## 기본`);
  lines.push(`${data.input.year}.${pad2(data.input.month)}.${pad2(data.input.day)} ${pad2(data.input.hour)}:${pad2(data.input.minute)} ${data.input.gender} ${calendarKo} ${data.input.timezone} 만 ${data.currentAge}세`);
  lines.push(`일간 ${data.dayStem}(${dayDetail.stemKo})${dayDetail.element.stem}${yinYangSign(dayDetail.yinYang.stem)} 강약: ${strengthChar}(${data.advanced.dayStrength.score}) 격: ${data.advanced.geukguk} 용신: ${data.advanced.yongsin.join(", ") || "-"}`);

  // ## 원국
  lines.push("");
  lines.push("## 원국");
  lines.push(compactRow("", ["시", "일", "월", "연"]));
  lines.push(compactRow("干", pillarKeys.map((k) => compactPillarToken(data, k, "stem"))));
  lines.push(compactRow("支", pillarKeys.map((k) => compactPillarToken(data, k, "branch"))));
  lines.push(compactRow("장간", pillarKeys.map((k) => compactHidden(data, k))));
  lines.push(compactRow("干성", pillarKeys.map((k) => data.tenGods[k].stem)));
  lines.push(compactRow("支성", pillarKeys.map((k) => data.tenGods[k].branch)));
  lines.push(compactRow("봉12", pillarKeys.map((k) => data.stages12.bong[k])));
  lines.push(compactRow("거12", pillarKeys.map((k) => data.stages12.geo[k])));
  lines.push(compactRow("12살", pillarKeys.map((k) => data.sals[k].twelveSal)));
  lines.push(compactRow("특살", pillarKeys.map((k) => data.sals[k].specialSals.join(",") || "-")));

  // ## 오행
  const el = countElementsByStemBranch(data);
  const fmtEl = (r: Record<string, number>) => `목${r["목"]} 화${r["화"]} 토${r["토"]} 금${r["금"]} 수${r["수"]}`;
  lines.push("");
  lines.push("## 오행");
  lines.push(`干: ${fmtEl(el.stem)} | 支: ${fmtEl(el.branch)} | 계: ${fmtEl(data.fiveElements)}`);
  lines.push(`공망 ${data.gongmang.branches[0]}(${data.gongmang.branchesKo[0]}) ${data.gongmang.branches[1]}(${data.gongmang.branchesKo[1]})`);
  lines.push(`길신: ${data.advanced.sinsal.gilsin.join(", ") || "-"} / 흉신: ${data.advanced.sinsal.hyungsin.join(", ") || "-"}`);

  // ## 관계
  const relParts: string[] = [];
  const stemHap = data.stemRelations.filter((r) => r.type === "합");
  const stemChung = data.stemRelations.filter((r) => r.type === "충");
  if (stemHap.length) relParts.push(`干합: ${stemHap.map((r) => r.desc.replace(/ 합/, "")).join("; ")}`);
  if (stemChung.length) relParts.push(`干충: ${stemChung.map((r) => r.desc.replace(/ 충/, "")).join("; ")}`);
  for (const key of BRANCH_REL_KEYS) {
    const text = collectRelationText(data.branchRelations[key]);
    if (text) relParts.push(`${key}: ${text.replaceAll(` ${key}`, "")}`);
  }
  lines.push("");
  lines.push("## 관계");
  lines.push(relParts.join(" | ") || "없음");

  // ## 대운
  lines.push("");
  const dirKo = data.daeun.basis.direction === "forward" ? "순행" : "역행";
  let daeunHead = `## 대운 ${dirKo} 시작 ${data.daeun.startAge}세`;
  if (data.daeun.current) {
    const rem = data.daeun.current.endAge - data.currentAge;
    daeunHead += ` 현재 ★${data.daeun.current.ganzhi}(${data.daeun.current.startAge}~${data.daeun.current.endAge} 잔여 ${rem}년)`;
  }
  lines.push(daeunHead);
  for (const item of data.daeun.list) {
    const mark = data.daeun.current && item.age_range === data.daeun.current.age_range ? "★" : " ";
    const sal = item.sal.length ? item.sal.join(",") : "-";
    lines.push(`${mark}${item.startAge}(${item.startYear}) ${item.ganzhi} ${item.stemTenGod}/${item.branchTenGod} ${item["12unsung"]} ${sal}`);
  }

  // ## 세운
  lines.push("");
  lines.push(`## 세운 ${currentYear} 기준`);
  for (const s of data.seyun) {
    const mark = s.year === currentYear ? "★" : " ";
    lines.push(`${mark}${s.year} ${s.ganzhi} ${s.tenGodStem}/${s.tenGodBranch} ${s.stage12}`);
  }

  // ## 월운
  lines.push("");
  lines.push(`## 월운 ${currentYear}`);
  for (const w of data.wolun) {
    lines.push(`${w.month}월 ${w.ganzhi} ${w.stem_tengod}/${w.branch_tengod} ${w["12unsung"]}`);
  }

  // ## 만세력
  const c = data.reference.codes;
  lines.push("");
  lines.push("## 만세력");
  lines.push(`이달 ${c.thisMonth} 다음 ${c.nextMonth} 오늘 ${c.today} 내일 ${c.tomorrow} (${data.reference.now.split(" ")[0]})`);

  return lines.join("\n");
}
