import { writeFile } from "node:fs/promises";
import { lintRules } from "../packages/linter/dist/index.js";

const outputPath = new URL("../docs/reference/linter-rules.md", import.meta.url);
const requiredFields = ["description", "whyItMatters", "badExample", "goodExample", "suggestedFix"];

function assertRuleDocs(rule) {
  for (const field of requiredFields) {
    if (typeof rule.docs?.[field] !== "string" || rule.docs[field].trim().length === 0) {
      throw new Error(`Rule ${rule.ruleId} is missing documentation field: ${field}`);
    }
  }
}

function escapeMarkdownText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeTableText(value) {
  return escapeMarkdownText(value).replace(/\|/g, "\\|");
}

const rules = [...lintRules].sort((left, right) => left.ruleId.localeCompare(right.ruleId));
for (const rule of rules) {
  assertRuleDocs(rule);
}

const lines = [
  "---",
  "title: Linter rules",
  "---",
  "",
  "# Linter rules",
  "",
  "This page is generated from linter rule metadata. Do not edit it by hand; run `pnpm docs:linter-rules` after changing rule metadata.",
  "",
  "The AgentSpec linter is rule-based. Each rule is independent and returns a normalised diagnostic:",
  "",
  "- `ruleId`",
  "- `severity`: `error`, `warning` or `info`",
  "- `message`",
  "- `path`",
  "- `suggestion`",
  "- `confidence`",
  "",
  "## Current rules",
  "",
  "| Rule | Severity | Description |",
  "| --- | --- | --- |",
  ...rules.map((rule) => `| \`${rule.ruleId}\` | ${rule.severity} | ${escapeTableText(rule.docs.description)} |`),
  ""
];

for (const rule of rules) {
  lines.push(
    `## ${rule.ruleId}`,
    "",
    `- **Severity:** ${rule.severity}`,
    `- **Description:** ${escapeMarkdownText(rule.docs.description)}`,
    "",
    "### Why it matters",
    "",
    escapeMarkdownText(rule.docs.whyItMatters),
    "",
    "### Bad example",
    "",
    "```yaml",
    rule.docs.badExample,
    "```",
    "",
    "### Good example",
    "",
    "```yaml",
    rule.docs.goodExample,
    "```",
    "",
    "### Suggested fix",
    "",
    escapeMarkdownText(rule.docs.suggestedFix),
    ""
  );
}

lines.push(
  "## Design principles",
  "",
  "Rules should be deterministic, explainable and conservative. The linter should identify likely engineering issues without pretending to prove that an AI system is safe.",
  "",
  "When adding rules, prefer:",
  "",
  "- clear rule identifiers",
  "- stable paths into the YAML structure",
  "- actionable suggestions",
  "- tests for positive and negative cases",
  ""
);

await writeFile(outputPath, `${lines.join("\n").trimEnd()}\n`, "utf8");
