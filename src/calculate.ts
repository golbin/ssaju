/**
 * Saju Library
 *
 * Architecture:
 * - manse.ts: calendar conversion/time normalization/four pillars/solar terms
 * - analyze.ts: derived saju analysis (ten-gods, relations, daeun, interpretation)
 * - format.ts: markdown and LLM-friendly text output
 */
import { generateMarkdownSummary, generateCompactText } from "./format.ts";
import {
  calculateFourPillars,
  getKstNowDate,
  buildReferenceCodes,
  lunarToSolar,
  normalizeBirthDate,
  normalizeInput,
  solarToLunar,
  validateInput,
} from "./manse.ts";
import { analyzeChart } from "./analyze.ts";
import type { SajuInput, SajuResult } from "./types.ts";

export type * from "./types.ts";

export function calculateSaju(input: SajuInput): SajuResult {
  const normalizedInput = normalizeInput(input);
  validateInput(normalizedInput);

  const normalizedBirth = normalizeBirthDate({
    calendar: normalizedInput.calendar,
    leap: normalizedInput.leap,
    timezone: normalizedInput.timezone,
    longitude: normalizedInput.longitude,
    year: normalizedInput.year,
    month: normalizedInput.month,
    day: normalizedInput.day,
    hour: normalizedInput.hour,
    minute: normalizedInput.minute,
    applyLocalMeanTime: normalizedInput.applyLocalMeanTime,
  });

  const calcBirth = normalizedBirth.calculation;
  const fourPillars = calculateFourPillars({
    year: calcBirth.year,
    month: calcBirth.month,
    day: calcBirth.day,
    hour: calcBirth.hour,
    minute: calcBirth.minute,
  });

  const refNow = normalizedInput.now ? new Date(normalizedInput.now) : new Date();
  const currentDate = getKstNowDate(refNow);

  const analysis = analyzeChart({
    fourPillars,
    normalizedBirth,
    normalizedInput,
    currentDate,
  });

  const reference = buildReferenceCodes(refNow);

  const result: SajuResult = {
    input: {
      year: normalizedInput.year,
      month: normalizedInput.month,
      day: normalizedInput.day,
      hour: normalizedInput.hour,
      minute: normalizedInput.minute,
      gender: normalizedInput.gender,
      calendar: normalizedInput.calendar,
      leap: normalizedInput.leap,
      timezone: normalizedInput.timezone,
      applyLocalMeanTime: normalizedInput.applyLocalMeanTime,
    },
    normalized: normalizedBirth,

    solar: { ...normalizedBirth.solar },
    pillars: analysis.pillars,
    pillarDetails: analysis.pillarDetails,
    dayStem: analysis.dayStem,
    dayBranch: analysis.dayBranch,
    gongmang: analysis.gongmang,
    fiveElements: analysis.fiveElements,
    tenGods: analysis.tenGods,
    stages12: analysis.stages12,
    stemRelations: analysis.stemRelations,
    branchRelations: analysis.branchRelations,
    sals: analysis.sals,
    currentAge: analysis.currentAge,
    daeun: analysis.daeun,
    seyun: analysis.seyun,
    wolun: analysis.wolun,
    advanced: analysis.advanced,

    reference,

    toMarkdown: null!,
    toCompact: null!,
  };

  result.toMarkdown = () => generateMarkdownSummary(result);
  result.toCompact = () => generateCompactText(result);

  return result;
}

export { lunarToSolar, solarToLunar };
