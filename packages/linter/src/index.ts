import type { AgentSpecDocument } from "@agentspec/spec";

export type LintIssueCode =
  | "conflicting-instruction"
  | "ambiguous-constraint"
  | "missing-fallback-behavior"
  | "undefined-route"
  | "undefined-tool"
  | "unused-tool"
  | "undefined-escalation"
  | "unreachable-escalation-path"
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
  const routeIds = new Set(spec.routes.map((route) => route.id));
  const toolIds = new Set(spec.tools.map((tool) => tool.id));
  const escalationIds = new Set(spec.escalations.map((escalation) => escalation.id));
  const referencedTools = new Set(spec.routes.flatMap((route) => route.tools ?? []));
  const referencedEscalations = new Set<string>();
  let hasUndefinedEscalation = false;

  if (!spec.instructions.fallback.trim()) {
    issues.push({
      code: "missing-fallback-behavior",
      severity: "error",
      path: "instructions.fallback",
      message: "Instructions must define fallback behavior for uncertain situations."
    });
  }

  const conflictingAction = findConflictingAlwaysNever(spec.instructions.system);
  if (conflictingAction) {
    issues.push({
      code: "conflicting-instruction",
      severity: "error",
      path: "instructions.system",
      message: `Instruction both requires and forbids "${conflictingAction}".`
    });
  }

  if (spec.instructions.constraints.some((constraint) => vagueConstraintPatterns.some((pattern) => pattern.test(constraint)))) {
    issues.push({
      code: "ambiguous-constraint",
      severity: "warning",
      path: "instructions.constraints",
      message: "Constraints include vague language that is hard to test deterministically."
    });
  }

  if (!spec.instructions.constraints.some((constraint) => safetyBoundaryPatterns.some((pattern) => pattern.test(constraint)))) {
    issues.push({
      code: "weak-safety-boundary",
      severity: "warning",
      path: "instructions.constraints",
      message: "Constraints should include explicit safety, privacy, escalation, or refusal boundaries."
    });
  }

  for (const [routeIndex, route] of spec.routes.entries()) {
    for (const toolId of route.tools ?? []) {
      if (!toolIds.has(toolId)) {
        issues.push({
          code: "undefined-tool",
          severity: "error",
          path: `routes.${routeIndex}.tools`,
          message: `Route "${route.id}" references undefined tool "${toolId}".`
        });
      }
    }

    if (route.escalateTo) {
      referencedEscalations.add(route.escalateTo);
      if (!escalationIds.has(route.escalateTo)) {
        hasUndefinedEscalation = true;
        issues.push({
          code: "undefined-escalation",
          severity: "error",
          path: `routes.${routeIndex}.escalateTo`,
          message: `Route "${route.id}" escalates to undefined path "${route.escalateTo}".`
        });
      }
    }
  }

  for (const [testIndex, test] of (spec.tests ?? []).entries()) {
    if (test.expect.route && !routeIds.has(test.expect.route)) {
      issues.push({
        code: "undefined-route",
        severity: "error",
        path: `tests.${testIndex}.expect.route`,
        message: `Test "${test.id}" expects undefined route "${test.expect.route}".`
      });
    }

    if (test.expect.escalation) {
      referencedEscalations.add(test.expect.escalation);
      if (!escalationIds.has(test.expect.escalation)) {
        hasUndefinedEscalation = true;
        issues.push({
          code: "undefined-escalation",
          severity: "error",
          path: `tests.${testIndex}.expect.escalation`,
          message: `Test "${test.id}" expects undefined escalation "${test.expect.escalation}".`
        });
      }
    }

    for (const toolId of test.expect.tools ?? []) {
      referencedTools.add(toolId);
      if (!toolIds.has(toolId)) {
        issues.push({
          code: "undefined-tool",
          severity: "error",
          path: `tests.${testIndex}.expect.tools`,
          message: `Test "${test.id}" expects undefined tool "${toolId}".`
        });
      }
    }
  }

  const unusedTools = spec.tools.map((tool) => tool.id).filter((toolId) => !referencedTools.has(toolId));
  if (unusedTools.length > 0) {
    issues.push({
      code: "unused-tool",
      severity: "warning",
      path: "tools",
      message: `Tools are defined but never referenced: ${unusedTools.join(", ")}.`
    });
  }

  const unreachableEscalations = spec.escalations
    .map((escalation) => escalation.id)
    .filter((escalationId) => !referencedEscalations.has(escalationId));
  if (!hasUndefinedEscalation && unreachableEscalations.length > 0) {
    issues.push({
      code: "unreachable-escalation-path",
      severity: "warning",
      path: "escalations",
      message: `Escalation paths are defined but unreachable: ${unreachableEscalations.join(", ")}.`
    });
  }

  return { issues };
}

function findConflictingAlwaysNever(text: string): string | undefined {
  const normalized = text.toLowerCase();
  const required = extractInstructionActions(normalized, "always");
  const forbidden = extractInstructionActions(normalized, "never");

  return required.find((action) => forbidden.includes(action));
}

function extractInstructionActions(text: string, keyword: "always" | "never"): string[] {
  const matches = [...text.matchAll(new RegExp(`\\b${keyword}\\s+([^.!?]+)`, "gi"))];
  return matches
    .map((match) => normalizeAction(match[1] ?? ""))
    .filter((action) => action.length > 0);
}

function normalizeAction(action: string): string {
  return action.replace(/\b(the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
}
