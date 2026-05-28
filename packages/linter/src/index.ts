import type { AgentSpecDocument } from "@agentspec/spec";

export type LintIssueCode =
  | "conflicting-instruction"
  | "ambiguous-constraint"
  | "missing-fallback-behavior"
  | "undefined-route"
  | "undefined-tool"
  | "unused-tool"
  | "undefined-handoff"
  | "unreachable-handoff"
  | "weak-safety-boundary";

export type LintIssueSeverity = "warning" | "error";

export type LintIssue = {
  code: LintIssueCode;
  severity: LintIssueSeverity;
  message: string;
  path: string;
};

export type LintResult = {
  issues: LintIssue[];
};

const vagueConstraintPatterns = [
  /\bbe careful\b/i,
  /\bdo the right thing\b/i,
  /\bbe helpful\b/i,
  /\buse (your )?best judgment\b/i,
  /\bappropriate\b/i
];

const safetyBoundaryPatterns = [
  /\bnever\b/i,
  /\bmust not\b/i,
  /\bdo not\b/i,
  /\bonly\b/i,
  /\bescalat(e|ion)\b/i,
  /\bhandoff\b/i,
  /\bhuman\b/i,
  /\bprotected\b/i,
  /\bpersonal\b/i,
  /\bsensitive\b/i,
  /\bprivacy\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcard\b/i
];

export function lintAgentSpec(spec: AgentSpecDocument): LintResult {
  const issues: LintIssue[] = [];
  const routeNames = new Set(spec.routes.map((route) => route.name));
  const toolNames = new Set(spec.tools.map((tool) => tool.name));
  const handoffNames = new Set(spec.handoffs.map((handoff) => handoff.name));
  const referencedTools = new Set<string>();
  const referencedHandoffs = new Set<string>();
  const escalationText = spec.constraints.escalation.join("\n").toLowerCase();
  for (const handoff of spec.handoffs) {
    if (escalationText.includes(handoff.name.toLowerCase())) {
      referencedHandoffs.add(handoff.name);
    }
  }
  let hasUndefinedHandoff = false;

  if (spec.constraints.escalation.length === 0 || spec.handoffs.length === 0) {
    issues.push({
      code: "missing-fallback-behavior",
      severity: "error",
      path: spec.constraints.escalation.length === 0 ? "constraints.escalation" : "handoffs",
      message: "AgentSpec must define escalation constraints and at least one handoff for fallback behavior."
    });
  }

  const conflictingInstruction = findConflictingInstruction(spec.instructions.do, spec.instructions.do_not);
  if (conflictingInstruction) {
    issues.push({
      code: "conflicting-instruction",
      severity: "error",
      path: "instructions",
      message: `Instruction appears in both do and do_not: "${conflictingInstruction}".`
    });
  }

  const allConstraints = Object.values(spec.constraints).flat();
  if (allConstraints.some((constraint) => vagueConstraintPatterns.some((pattern) => pattern.test(constraint)))) {
    issues.push({
      code: "ambiguous-constraint",
      severity: "warning",
      path: "constraints",
      message: "Constraints include vague language that is hard to test deterministically."
    });
  }

  const safetyText = [...spec.constraints.safety, ...spec.constraints.privacy, ...spec.instructions.do_not].join("\n");
  if (!safetyBoundaryPatterns.some((pattern) => pattern.test(safetyText))) {
    issues.push({
      code: "weak-safety-boundary",
      severity: "warning",
      path: "constraints.safety",
      message: "Safety and privacy constraints should include explicit boundaries, refusals, or escalation requirements."
    });
  }

  for (const [routeIndex, route] of spec.routes.entries()) {
    const target = parseTarget(route.target);

    if (target?.kind === "tool") {
      referencedTools.add(target.name);
      if (!toolNames.has(target.name)) {
        issues.push({
          code: "undefined-tool",
          severity: "error",
          path: `routes.${routeIndex}.target`,
          message: `Route "${route.name}" targets undefined tool "${target.name}".`
        });
      }
    }

    if (target?.kind === "handoff") {
      referencedHandoffs.add(target.name);
      if (!handoffNames.has(target.name)) {
        hasUndefinedHandoff = true;
        issues.push({
          code: "undefined-handoff",
          severity: "error",
          path: `routes.${routeIndex}.target`,
          message: `Route "${route.name}" targets undefined handoff "${target.name}".`
        });
      }
    }
  }

  for (const [testIndex, test] of (spec.tests ?? []).entries()) {
    if (test.expected_route && !routeNames.has(test.expected_route)) {
      issues.push({
        code: "undefined-route",
        severity: "error",
        path: `tests.${testIndex}.expected_route`,
        message: `Test "${test.name}" expects undefined route "${test.expected_route}".`
      });
    }

    if (test.expected_handoff && !handoffNames.has(test.expected_handoff)) {
      hasUndefinedHandoff = true;
      issues.push({
        code: "undefined-handoff",
        severity: "error",
        path: `tests.${testIndex}.expected_handoff`,
        message: `Test "${test.name}" expects undefined handoff "${test.expected_handoff}".`
      });
    }

    for (const toolName of [...test.expected_tool_calls, ...test.forbidden_tool_calls]) {
      if (!toolNames.has(toolName)) {
        issues.push({
          code: "undefined-tool",
          severity: "error",
          path: `tests.${testIndex}.expected_tool_calls`,
          message: `Test "${test.name}" references undefined tool "${toolName}".`
        });
      }
    }
  }

  const unusedTools = spec.tools.map((tool) => tool.name).filter((toolName) => !referencedTools.has(toolName));
  if (unusedTools.length > 0) {
    issues.push({
      code: "unused-tool",
      severity: "warning",
      path: "tools",
      message: `Tools are defined but never targeted by executable routes: ${unusedTools.join(", ")}.`
    });
  }

  const unreachableHandoffs = spec.handoffs
    .map((handoff) => handoff.name)
    .filter((handoffName) => !referencedHandoffs.has(handoffName));
  if (!hasUndefinedHandoff && unreachableHandoffs.length > 0) {
    issues.push({
      code: "unreachable-handoff",
      severity: "warning",
      path: "handoffs",
      message: `Handoffs are defined but unreachable from route targets: ${unreachableHandoffs.join(", ")}.`
    });
  }

  return { issues };
}

function findConflictingInstruction(doList: string[], doNotList: string[]): string | undefined {
  const forbidden = new Set(doNotList.map(normalizeInstruction));
  return doList.find((instruction) => forbidden.has(normalizeInstruction(instruction)));
}

function normalizeInstruction(instruction: string): string {
  return instruction
    .toLowerCase()
    .replace(/\b(do not|don't|never|must not|please|the|a|an)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseTarget(target: string): { kind: "tool" | "handoff"; name: string } | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();

  if ((kind === "tool" || kind === "handoff") && name.length > 0) {
    return { kind, name };
  }

  return undefined;
}
