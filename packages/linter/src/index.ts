import type { AgentSpecDocument, AgentSpecTool } from "@agentspec/spec";

export type LintRuleId =
  | "missing-primary-goal"
  | "conflicting-do-and-do-not"
  | "route-target-not-defined"
  | "handoff-without-condition"
  | "missing-fallback-route"
  | "tool-without-risk-level"
  | "high-risk-tool-without-auth"
  | "vague-instruction-language"
  | "duplicate-route-trigger"
  | "test-without-assertions"
  | "forbidden-operation-not-enforced"
  | "no-escalation-path";

export type PolicyRuleId =
  | "policy-required-constraint"
  | "policy-forbidden-tool"
  | "policy-escalation-required"
  | "policy-privacy-boundary"
  | "policy-mandatory-fallback";

export type LintIssueSeverity = "error" | "warning" | "info";

export type LintIssue = {
  ruleId: LintRuleId | PolicyRuleId;
  severity: LintIssueSeverity;
  message: string;
  path: string;
  suggestion: string;
  confidence: number;
};

export type LintResult = {
  issues: LintIssue[];
};

export type LintRuleDocumentation = {
  description: string;
  whyItMatters: string;
  badExample: string;
  goodExample: string;
  suggestedFix: string;
};

export type LintRule = {
  ruleId: LintRuleId;
  severity: LintIssueSeverity;
  docs: LintRuleDocumentation;
  run: (context: LintContext) => LintIssue[];
};


export type PolicyPackName = "public-sector-safe" | "financial-services" | "healthcare" | "internal-enterprise";

export type PolicyPack = {
  name: PolicyPackName;
  description: string;
  requiredConstraints: string[];
  forbiddenToolTerms: string[];
  escalationRequirements: string[];
  privacyBoundaries: string[];
  mandatoryFallbackTerms: string[];
};

export type LintOptions = {
  rules?: LintRule[];
  policyPacks?: PolicyPackName[];
};

type ParsedTarget = { kind: "tool" | "handoff"; name: string };

type LintContext = {
  spec: AgentSpecDocument;
  routeNames: Set<string>;
  toolNames: Set<string>;
  handoffNames: Set<string>;
  routeTargets: Array<{ routeIndex: number; routeName: string; target: string; parsed?: ParsedTarget }>;
};

const vagueInstructionPatterns = [
  /\bbe careful\b/i,
  /\bdo the right thing\b/i,
  /\bbe helpful\b/i,
  /\buse (your )?best judgment\b/i,
  /\bappropriate\b/i,
  /\bas needed\b/i,
  /\bwhen possible\b/i,
  /\btry to\b/i
];

const fallbackPatterns = [/\bfallback\b/i, /\bdefault\b/i, /\bunclear\b/i, /\bunknown\b/i, /\bpolicy gap\b/i];

export const lintRuleDocumentation: Record<LintRuleId, LintRuleDocumentation> = {
  "missing-primary-goal": {
    description: "Requires instructions.primary_goal to contain a clear objective.",
    whyItMatters: "Without a primary goal, reviewers and test authors cannot tell what behaviour the agent is optimised for.",
    badExample: "instructions:\n  primary_goal: \"\"",
    goodExample: "instructions:\n  primary_goal: Route billing questions to approved support paths.",
    suggestedFix: "Add one concise, testable primary goal that describes the agent's main responsibility."
  },
  "conflicting-do-and-do-not": {
    description: "Detects instructions that appear in both do and do_not lists.",
    whyItMatters: "Conflicting instructions make implementation and review ambiguous and can lead to unpredictable runtime behaviour.",
    badExample: "do:\n  - Approve refunds\ndo_not:\n  - Do not approve refunds",
    goodExample: "do:\n  - Explain the refund policy\ndo_not:\n  - Do not approve refunds without authorisation",
    suggestedFix: "Remove the duplicate meaning from one list, or rewrite the instructions so the boundary is explicit."
  },
  "route-target-not-defined": {
    description: "Checks that every route target references an existing tool or handoff.",
    whyItMatters: "Undefined route targets break routing plans and make deterministic tests misleading.",
    badExample: "routes:\n  - name: billing\n    target: tool:missing_tool",
    goodExample: "tools:\n  - name: account_lookup\nroutes:\n  - name: billing\n    target: tool:account_lookup",
    suggestedFix: "Define the referenced tool or handoff, or update the route target to an existing name."
  },
  "handoff-without-condition": {
    description: "Requires each handoff to describe the condition that triggers it.",
    whyItMatters: "A handoff without a condition cannot be reviewed as a clear escalation rule.",
    badExample: "handoffs:\n  - name: human_support\n    condition: \"\"",
    goodExample: "handoffs:\n  - name: human_support\n    condition: Account ownership is unclear or policy approval is required.",
    suggestedFix: "Add a specific condition that explains when the handoff should be used."
  },
  "missing-fallback-route": {
    description: "Looks for an explicit fallback route that targets a handoff.",
    whyItMatters: "Agents need a predictable path for unclear, unmatched or policy-gap situations.",
    badExample: "routes:\n  - name: billing_support\n    target: tool:account_lookup",
    goodExample: "routes:\n  - name: fallback_human_support\n    triggers: [fallback, unclear]\n    target: handoff:human_support",
    suggestedFix: "Add a low-priority fallback route with triggers such as fallback or unclear and target a handoff."
  },
  "tool-without-risk-level": {
    description: "Requires tools to declare risk_level metadata.",
    whyItMatters: "Risk metadata helps reviewers decide which tools need stronger controls and approval.",
    badExample: "tools:\n  - name: account_lookup\n    requires_auth: true",
    goodExample: "tools:\n  - name: account_lookup\n    requires_auth: true\n    risk_level: medium",
    suggestedFix: "Set risk_level to low, medium, high or critical."
  },
  "high-risk-tool-without-auth": {
    description: "Flags high or critical risk tools that do not require authentication.",
    whyItMatters: "High-risk actions without authentication assumptions can create serious security and governance gaps.",
    badExample: "tools:\n  - name: refund_approval\n    risk_level: high\n    requires_auth: false",
    goodExample: "tools:\n  - name: refund_approval\n    risk_level: high\n    requires_auth: true",
    suggestedFix: "Set requires_auth to true, or lower the risk level only if the tool is genuinely low impact."
  },
  "vague-instruction-language": {
    description: "Flags subjective instruction language such as be careful or use best judgement.",
    whyItMatters: "Vague instructions are hard to test, review and enforce consistently.",
    badExample: "secondary_goals:\n  - Use best judgement and be helpful.",
    goodExample: "secondary_goals:\n  - Escalate requests when account ownership is unclear.",
    suggestedFix: "Replace subjective language with observable, testable behaviour."
  },
  "duplicate-route-trigger": {
    description: "Detects route triggers reused across multiple routes.",
    whyItMatters: "Duplicate triggers can make deterministic route selection ambiguous and hide routing regressions.",
    badExample: "routes:\n  - name: billing\n    triggers: [refund]\n  - name: disputes\n    triggers: [refund]",
    goodExample: "routes:\n  - name: billing\n    triggers: [invoice]\n  - name: disputes\n    triggers: [chargeback]",
    suggestedFix: "Make triggers distinct or consolidate overlapping routes."
  },
  "test-without-assertions": {
    description: "Requires each test scenario to include at least one assertion.",
    whyItMatters: "Tests without assertions document inputs but do not define expected behaviour.",
    badExample: "tests:\n  - name: refund route\n    assertions: []",
    goodExample: "tests:\n  - name: refund route\n    assertions:\n      - route is billing_support",
    suggestedFix: "Add assertions that describe expected route, handoff or tool-call behaviour."
  },
  "forbidden-operation-not-enforced": {
    description: "Checks forbidden tool operations are reflected in instructions or constraints.",
    whyItMatters: "A forbidden operation listed only on a tool can be missed by reviewers reading behavioural instructions.",
    badExample: "forbidden_operations:\n  - read_full_payment_card",
    goodExample: "do_not:\n  - Do not read full payment card data\nforbidden_operations:\n  - read_full_payment_card",
    suggestedFix: "Add a matching do_not instruction or safety, privacy or data_access constraint."
  },
  "no-escalation-path": {
    description: "Requires a complete escalation path with constraints, handoffs and a route to a handoff.",
    whyItMatters: "Without an escalation path, unclear or risky cases may have no safe deterministic route.",
    badExample: "constraints:\n  escalation: []\nhandoffs: []",
    goodExample: "constraints:\n  escalation:\n    - Fallback to human_support when unclear.\nroutes:\n  - target: handoff:human_support",
    suggestedFix: "Define escalation constraints, at least one handoff and a route that targets handoff:<name>."
  }
};


export const builtinPolicyPacks: Record<PolicyPackName, PolicyPack> = {
  "public-sector-safe": {
    name: "public-sector-safe",
    description: "Baseline safety, privacy and escalation expectations for public sector casework.",
    requiredConstraints: ["statutory", "casework"],
    forbiddenToolTerms: ["raw", "export_personal", "delete", "unrestricted"],
    escalationRequirements: ["senior", "caseworker"],
    privacyBoundaries: ["protected personal data"],
    mandatoryFallbackTerms: ["fallback", "unclear"]
  },
  "financial-services": {
    name: "financial-services",
    description: "Baseline controls for financial services workflows.",
    requiredConstraints: ["audit", "fraud", "regulated"],
    forbiddenToolTerms: ["transfer_funds", "approve_credit", "delete_transaction"],
    escalationRequirements: ["compliance", "review"],
    privacyBoundaries: ["financial data", "customer data"],
    mandatoryFallbackTerms: ["fallback", "unclear"]
  },
  healthcare: {
    name: "healthcare",
    description: "Baseline controls for healthcare and patient-support workflows.",
    requiredConstraints: ["clinical", "patient", "consent"],
    forbiddenToolTerms: ["diagnose", "prescribe", "delete_record"],
    escalationRequirements: ["clinician", "review"],
    privacyBoundaries: ["patient data", "clinical"],
    mandatoryFallbackTerms: ["fallback", "unclear"]
  },
  "internal-enterprise": {
    name: "internal-enterprise",
    description: "Baseline controls for internal enterprise assistants.",
    requiredConstraints: ["access", "confidential", "policy"],
    forbiddenToolTerms: ["grant_admin", "delete_user", "export_confidential"],
    escalationRequirements: ["owner", "review"],
    privacyBoundaries: ["confidential", "employee"],
    mandatoryFallbackTerms: ["fallback", "unclear"]
  }
};

export const lintRules: LintRule[] = [
  {
    ruleId: "missing-primary-goal",
    severity: "error",
    docs: lintRuleDocumentation["missing-primary-goal"],
    run: ({ spec }) =>
      hasText(spec.instructions.primary_goal)
        ? []
        : [
            issue({
              ruleId: "missing-primary-goal",
              severity: "error",
              path: "instructions.primary_goal",
              message: "Instructions must define a primary goal.",
              suggestion: "Add instructions.primary_goal with one clear, testable objective for the agent.",
              confidence: 0.99
            })
          ]
  },
  {
    ruleId: "conflicting-do-and-do-not",
    severity: "error",
    docs: lintRuleDocumentation["conflicting-do-and-do-not"],
    run: ({ spec }) => {
      const forbidden = new Map(spec.instructions.do_not.map((instruction) => [normalizeInstruction(instruction), instruction]));
      const conflicts = spec.instructions.do
        .map((instruction, index) => ({ instruction, index, normalized: normalizeInstruction(instruction) }))
        .filter(({ normalized }) => normalized.length > 0 && forbidden.has(normalized));

      return conflicts.map(({ instruction, index }) =>
        issue({
          ruleId: "conflicting-do-and-do-not",
          severity: "error",
          path: `instructions.do.${index}`,
          message: `Instruction conflicts with do_not: "${instruction}".`,
          suggestion: "Remove the duplicate meaning from either instructions.do or instructions.do_not.",
          confidence: 0.95
        })
      );
    }
  },
  {
    ruleId: "route-target-not-defined",
    severity: "error",
    docs: lintRuleDocumentation["route-target-not-defined"],
    run: ({ routeTargets, toolNames, handoffNames }) =>
      routeTargets.flatMap(({ routeIndex, routeName, target, parsed }) => {
        if (!parsed) {
          return [
            issue({
              ruleId: "route-target-not-defined",
              severity: "error",
              path: `routes.${routeIndex}.target`,
              message: `Route "${routeName}" uses unsupported target "${target}".`,
              suggestion: "Use target format tool:<tool_name> or handoff:<handoff_name>.",
              confidence: 0.98
            })
          ];
        }

        const exists = parsed.kind === "tool" ? toolNames.has(parsed.name) : handoffNames.has(parsed.name);
        return exists
          ? []
          : [
              issue({
                ruleId: "route-target-not-defined",
                severity: "error",
                path: `routes.${routeIndex}.target`,
                message: `Route "${routeName}" targets undefined ${parsed.kind} "${parsed.name}".`,
                suggestion: `Define ${parsed.kind} "${parsed.name}" or update the route target to an existing ${parsed.kind}.`,
                confidence: 0.99
              })
            ];
      })
  },
  {
    ruleId: "handoff-without-condition",
    severity: "error",
    docs: lintRuleDocumentation["handoff-without-condition"],
    run: ({ spec }) =>
      spec.handoffs.flatMap((handoff, index) =>
        hasText(handoff.condition)
          ? []
          : [
              issue({
                ruleId: "handoff-without-condition",
                severity: "error",
                path: `handoffs.${index}.condition`,
                message: `Handoff "${handoff.name}" is missing a condition.`,
                suggestion: "Describe the exact situation that triggers this handoff.",
                confidence: 0.99
              })
            ]
      )
  },
  {
    ruleId: "missing-fallback-route",
    severity: "warning",
    docs: lintRuleDocumentation["missing-fallback-route"],
    run: ({ spec, routeTargets }) => {
      const hasFallbackRoute = spec.routes.some((route) => {
        const routeText = `${route.name} ${route.description} ${route.triggers.join(" ")}`;
        return fallbackPatterns.some((pattern) => pattern.test(routeText));
      });
      const hasHandoffTarget = routeTargets.some(({ parsed }) => parsed?.kind === "handoff");

      return hasFallbackRoute && hasHandoffTarget
        ? []
        : [
            issue({
              ruleId: "missing-fallback-route",
              severity: "warning",
              path: "routes",
              message: "No explicit fallback route targets a handoff for unclear or unmatched situations.",
              suggestion: "Add a low-priority fallback route with triggers like fallback/unclear and target handoff:<name>.",
              confidence: 0.88
            })
          ];
    }
  },
  {
    ruleId: "tool-without-risk-level",
    severity: "warning",
    docs: lintRuleDocumentation["tool-without-risk-level"],
    run: ({ spec }) =>
      spec.tools.flatMap((tool, index) =>
        hasText((tool as Partial<AgentSpecTool>).risk_level)
          ? []
          : [
              issue({
                ruleId: "tool-without-risk-level",
                severity: "warning",
                path: `tools.${index}.risk_level`,
                message: `Tool "${tool.name}" does not declare a risk level.`,
                suggestion: "Set risk_level to low, medium, high, or critical.",
                confidence: 0.99
              })
            ]
      )
  },
  {
    ruleId: "high-risk-tool-without-auth",
    severity: "error",
    docs: lintRuleDocumentation["high-risk-tool-without-auth"],
    run: ({ spec }) =>
      spec.tools.flatMap((tool, index) =>
        (tool.risk_level === "high" || tool.risk_level === "critical") && !tool.requires_auth
          ? [
              issue({
                ruleId: "high-risk-tool-without-auth",
                severity: "error",
                path: `tools.${index}.requires_auth`,
                message: `High-risk tool "${tool.name}" does not require authentication.`,
                suggestion: "Set requires_auth: true or lower the risk level if authentication is not needed.",
                confidence: 0.97
              })
            ]
          : []
      )
  },
  {
    ruleId: "vague-instruction-language",
    severity: "warning",
    docs: lintRuleDocumentation["vague-instruction-language"],
    run: ({ spec }) => {
      const candidates = [
        { path: "instructions.primary_goal", value: spec.instructions.primary_goal },
        ...spec.instructions.secondary_goals.map((value, index) => ({ path: `instructions.secondary_goals.${index}`, value })),
        ...spec.instructions.do.map((value, index) => ({ path: `instructions.do.${index}`, value })),
        ...spec.instructions.do_not.map((value, index) => ({ path: `instructions.do_not.${index}`, value }))
      ];

      return candidates.flatMap(({ path, value }) =>
        vagueInstructionPatterns.some((pattern) => pattern.test(value))
          ? [
              issue({
                ruleId: "vague-instruction-language",
                severity: "warning",
                path,
                message: `Instruction uses vague language: "${value}".`,
                suggestion: "Replace subjective phrasing with specific, observable behavior.",
                confidence: 0.86
              })
            ]
          : []
      );
    }
  },
  {
    ruleId: "duplicate-route-trigger",
    severity: "warning",
    docs: lintRuleDocumentation["duplicate-route-trigger"],
    run: ({ spec }) => {
      const seen = new Map<string, { routeName: string; path: string }>();
      const issues: LintIssue[] = [];

      for (const [routeIndex, route] of spec.routes.entries()) {
        for (const [triggerIndex, trigger] of route.triggers.entries()) {
          const normalized = normalizeTrigger(trigger);
          const existing = seen.get(normalized);
          const path = `routes.${routeIndex}.triggers.${triggerIndex}`;

          if (existing) {
            issues.push(
              issue({
                ruleId: "duplicate-route-trigger",
                severity: "warning",
                path,
                message: `Trigger "${trigger}" is duplicated by routes "${existing.routeName}" and "${route.name}".`,
                suggestion: "Make route triggers distinct or consolidate the overlapping routes.",
                confidence: 0.94
              })
            );
          } else {
            seen.set(normalized, { routeName: route.name, path });
          }
        }
      }

      return issues;
    }
  },
  {
    ruleId: "test-without-assertions",
    severity: "warning",
    docs: lintRuleDocumentation["test-without-assertions"],
    run: ({ spec }) =>
      (spec.tests ?? []).flatMap((test, index) =>
        test.assertions.length > 0
          ? []
          : [
              issue({
                ruleId: "test-without-assertions",
                severity: "warning",
                path: `tests.${index}.assertions`,
                message: `Test "${test.name}" does not include assertions.`,
                suggestion: "Add assertions that describe required behavior or safety boundaries.",
                confidence: 0.99
              })
            ]
      )
  },
  {
    ruleId: "forbidden-operation-not-enforced",
    severity: "warning",
    docs: lintRuleDocumentation["forbidden-operation-not-enforced"],
    run: ({ spec }) => {
      const enforcementText = normalizeInstruction(
        [
          ...spec.instructions.do_not,
          ...spec.constraints.safety,
          ...spec.constraints.privacy,
          ...spec.constraints.compliance,
          ...spec.constraints.data_access
        ].join(" ")
      );

      return spec.tools.flatMap((tool, toolIndex) =>
        tool.forbidden_operations.flatMap((operation, operationIndex) => {
          const normalizedOperation = normalizeOperation(operation);
          return enforcementText.includes(normalizedOperation)
            ? []
            : [
                issue({
                  ruleId: "forbidden-operation-not-enforced",
                  severity: "warning",
                  path: `tools.${toolIndex}.forbidden_operations.${operationIndex}`,
                  message: `Forbidden operation "${operation}" on tool "${tool.name}" is not reflected in instructions or constraints.`,
                  suggestion: "Add a matching do_not instruction or safety/privacy/data_access constraint that enforces this forbidden operation.",
                  confidence: 0.82
                })
              ];
        })
      );
    }
  },
  {
    ruleId: "no-escalation-path",
    severity: "error",
    docs: lintRuleDocumentation["no-escalation-path"],
    run: ({ spec, routeTargets }) => {
      const hasEscalationConstraint = spec.constraints.escalation.some(hasText);
      const hasHandoff = spec.handoffs.length > 0;
      const hasRouteToHandoff = routeTargets.some(({ parsed }) => parsed?.kind === "handoff");

      return hasEscalationConstraint && hasHandoff && hasRouteToHandoff
        ? []
        : [
            issue({
              ruleId: "no-escalation-path",
              severity: "error",
              path: "handoffs",
              message: "AgentSpec does not define a complete escalation path.",
              suggestion: "Define escalation constraints, at least one handoff, and a route that targets handoff:<name>.",
              confidence: 0.93
            })
          ];
    }
  }
];

export function lintAgentSpec(spec: AgentSpecDocument, optionsOrRules: LintRule[] | LintOptions = lintRules): LintResult {
  const context = createContext(spec);
  const rules = Array.isArray(optionsOrRules) ? optionsOrRules : optionsOrRules.rules ?? lintRules;
  const policyPacks = Array.isArray(optionsOrRules) ? [] : optionsOrRules.policyPacks ?? [];
  const issues = [
    ...rules.flatMap((rule) => rule.run(context)),
    ...policyPacks.flatMap((packName) => lintPolicyPack(spec, builtinPolicyPacks[packName]))
  ];

  return {
    issues: issues.sort(compareIssues)
  };
}


function lintPolicyPack(spec: AgentSpecDocument, pack: PolicyPack): LintIssue[] {
  if (!pack) return [];
  const issues: LintIssue[] = [];
  const allConstraintText = normalizePolicyText([
    ...spec.constraints.safety,
    ...spec.constraints.privacy,
    ...spec.constraints.compliance,
    ...spec.constraints.escalation,
    ...spec.constraints.data_access
  ].join(" "));
  const privacyText = normalizePolicyText(spec.constraints.privacy.join(" "));
  const escalationText = normalizePolicyText(spec.constraints.escalation.join(" "));
  const routeText = normalizePolicyText(spec.routes.map((route) => `${route.name} ${route.description} ${route.triggers.join(" ")} ${route.target}`).join(" "));

  for (const required of pack.requiredConstraints) {
    if (!allConstraintText.includes(normalizePolicyText(required))) {
      issues.push(policyIssue("policy-required-constraint", "error", "constraints", pack, `Required policy constraint is missing: ${required}.`, `Add a ${required} constraint for the ${pack.name} policy pack.`));
    }
  }

  for (const boundary of pack.privacyBoundaries) {
    if (!privacyText.includes(normalizePolicyText(boundary))) {
      issues.push(policyIssue("policy-privacy-boundary", "error", "constraints.privacy", pack, `Required privacy boundary is missing: ${boundary}.`, `Add an explicit privacy boundary covering ${boundary}.`));
    }
  }

  for (const requirement of pack.escalationRequirements) {
    if (!escalationText.includes(normalizePolicyText(requirement))) {
      issues.push(policyIssue("policy-escalation-required", "error", "constraints.escalation", pack, `Required escalation requirement is missing: ${requirement}.`, `Add escalation language covering ${requirement}.`));
    }
  }

  for (const term of pack.mandatoryFallbackTerms) {
    if (!routeText.includes(normalizePolicyText(term))) {
      issues.push(policyIssue("policy-mandatory-fallback", "error", "routes", pack, `Mandatory fallback routing term is missing: ${term}.`, `Add a fallback route that covers ${term} situations.`));
    }
  }

  for (const [index, tool] of spec.tools.entries()) {
    const toolText = normalizePolicyText(`${tool.name} ${tool.description} ${tool.allowed_operations.join(" ")}`);
    for (const forbidden of pack.forbiddenToolTerms) {
      if (toolText.includes(normalizePolicyText(forbidden))) {
        issues.push(policyIssue("policy-forbidden-tool", "error", `tools.${index}`, pack, `Tool "${tool.name}" appears to use forbidden policy capability: ${forbidden}.`, `Remove the capability or document an approved exception outside the Agent Lint spec.`));
      }
    }
  }

  return issues;
}

function policyIssue(ruleId: PolicyRuleId, severity: LintIssueSeverity, path: string, pack: PolicyPack, message: string, suggestion: string): LintIssue {
  return { ruleId, severity, path, message: `[${pack.name}] ${message}`, suggestion, confidence: 0.9 };
}

function normalizePolicyText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function createContext(spec: AgentSpecDocument): LintContext {
  return {
    spec,
    routeNames: new Set(spec.routes.map((route) => route.name)),
    toolNames: new Set(spec.tools.map((tool) => tool.name)),
    handoffNames: new Set(spec.handoffs.map((handoff) => handoff.name)),
    routeTargets: spec.routes.map((route, routeIndex) => ({
      routeIndex,
      routeName: route.name,
      target: route.target,
      parsed: parseTarget(route.target)
    }))
  };
}

function issue(issue: LintIssue): LintIssue {
  return issue;
}

function compareIssues(a: LintIssue, b: LintIssue): number {
  const severityOrder: Record<LintIssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return severityOrder[a.severity] - severityOrder[b.severity] || a.path.localeCompare(b.path) || a.ruleId.localeCompare(b.ruleId);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeInstruction(instruction: string): string {
  return instruction
    .toLowerCase()
    .replace(/\b(do not|don't|never|must not|please|the|a|an)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOperation(operation: string): string {
  return normalizeInstruction(operation.replace(/_/g, " "));
}

function normalizeTrigger(trigger: string): string {
  return trigger.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseTarget(target: string): ParsedTarget | undefined {
  const [kind, ...rest] = target.split(":");
  const name = rest.join(":").trim();

  if ((kind === "tool" || kind === "handoff") && name.length > 0) {
    return { kind, name };
  }

  return undefined;
}
