import { calculateSaju } from "./index.ts";

const result = calculateSaju({
  year: 2001,
  month: 11,
  day: 3,
  hour: 14,
  minute: 20,
  gender: "남",
  calendar: "solar",
});

console.log("=== Compact 출력 ===\n");
console.log(result.toCompact());

console.log("\n=== Markdown 출력 ===\n");
console.log(result.toMarkdown());
