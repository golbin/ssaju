import os from "node:os";
import { performance } from "node:perf_hooks";
import { calculateSaju } from "../dist/index.mjs";

const WARMUP = Number(process.env.SAJU_BENCH_WARMUP ?? 800);
const ITERATIONS = Number(process.env.SAJU_BENCH_ITERS ?? 6000);

const CASES = {
  calculate_solar: {
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
  },
  calculate_lunar: {
    year: 1992,
    month: 9,
    day: 29,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "lunar",
    leap: false,
  },
  calculate_solar_local_mean_time: {
    year: 1992,
    month: 10,
    day: 24,
    hour: 5,
    minute: 30,
    gender: "남",
    calendar: "solar",
    applyLocalMeanTime: true,
    longitude: 126.9784,
  },
};

function summarize(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((acc, v) => acc + v, 0) / times.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return {
    meanMs: mean,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    opsPerSec: 1000 / mean,
  };
}

function benchCalc(input) {
  for (let i = 0; i < WARMUP; i++) {
    calculateSaju(input);
  }

  const times = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    calculateSaju(input);
    times.push(performance.now() - t0);
  }
  return summarize(times);
}

function benchWithFormatter(input, mode) {
  for (let i = 0; i < WARMUP; i++) {
    const result = calculateSaju(input);
    if (mode === "compact") {
      result.toCompact();
    } else {
      result.toMarkdown();
    }
  }

  const times = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    const result = calculateSaju(input);
    if (mode === "compact") {
      result.toCompact();
    } else {
      result.toMarkdown();
    }
    times.push(performance.now() - t0);
  }
  return summarize(times);
}

const environment = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpus: os.cpus()?.length ?? 0,
  cpuModel: os.cpus()?.[0]?.model ?? "unknown",
  warmup: WARMUP,
  iterations: ITERATIONS,
};

const results = {
  calculate_solar: benchCalc(CASES.calculate_solar),
  calculate_lunar: benchCalc(CASES.calculate_lunar),
  calculate_solar_local_mean_time: benchCalc(CASES.calculate_solar_local_mean_time),
  calculate_plus_compact: benchWithFormatter(CASES.calculate_solar, "compact"),
  calculate_plus_markdown: benchWithFormatter(CASES.calculate_solar, "markdown"),
};

console.log(JSON.stringify({ environment, results }, null, 2));
