import type { LintIssue } from "@agentspec/linter";

interface FindingCardProps {
  issue: LintIssue;
}

const severityMap: Record<string, { cls: string; label: string }> = {
  error: { cls: "badge-error", label: "Error" },
  warning: { cls: "badge-warning", label: "Warning" },
  info: { cls: "badge-info", label: "Info" },
};

const ruleExplanations: Record<string, { why: string; fix: string }> = {
  "missing-primary-goal": {
    why: "Without a primary goal, the agent has no authoritative objective and may behave unpredictably.",
    fix: "Add an instructions.primary_goal field that states the agent's single most important objective.",
  },
  "route-target-not-defined": {
    why: "A route references a tool or handoff that does not exist, so the agent cannot execute it.",
    fix: "Define the missing tool or handoff, or correct the route target name.",
  },
  "high-risk-tool-without-auth": {
    why: "A tool marked as high risk does not require authentication, creating a security gap.",
    fix: "Set requires_auth to true on the tool definition.",
  },
  "duplicate-route-name": {
    why: "Duplicate route names make it ambiguous which route will be selected.",
    fix: "Rename one of the duplicate routes to be unique.",
  },
  "missing-fallback-route": {
    why: "Without a fallback route, messages that match no trigger have no safe path.",
    fix: "Add a route with a 'fallback' trigger and high priority number.",
  },
  "unused-tool": {
    why: "A tool is defined but never referenced in any route, suggesting dead configuration.",
    fix: "Remove the unused tool or create a route that targets it.",
  },
  "unused-handoff": {
    why: "A handoff is defined but never referenced, suggesting incomplete wiring.",
    fix: "Remove the unused handoff or create a route that targets it.",
  },
  "overlapping-triggers": {
    why: "Multiple routes share the same trigger word, creating ambiguity in routing.",
    fix: "Review trigger words and remove overlaps, or adjust priorities to create clear precedence.",
  },
  "empty-do-not-list": {
    why: "The agent has no explicit prohibitions, increasing risk of unintended behaviour.",
    fix: "Add at least one do_not instruction that limits agent behaviour.",
  },
  "missing-escalation-constraint": {
    why: "No escalation constraint means the agent has no rule for when to hand off to a human.",
    fix: "Add a constraints.escalation entry describing when human review is required.",
  },
  "handoff-missing-context": {
    why: "A handoff does not specify required context, so the receiving party may lack key information.",
    fix: "Add a required_context array to the handoff listing the fields the recipient needs.",
  },
  "forbidden-op-not-in-allowed": {
    why: "A forbidden operation is also listed as allowed, creating a contradictory tool definition.",
    fix: "Remove the operation from either the allowed or forbidden list.",
  },
};

export function FindingCard({ issue }: FindingCardProps) {
  const sev = severityMap[issue.severity] ?? severityMap.info;
  const explanation = ruleExplanations[issue.ruleId];

  return (
    <div className={`finding-card finding-card-${issue.severity}`}>
      <div className="finding-header">
        <span className={`badge ${sev.cls}`}>{sev.label}</span>
        <span className="finding-title">{issue.ruleId}</span>
      </div>
      <div className="finding-body">
        <p>{issue.message}</p>
        {issue.path && (
          <dl>
            <dt>Affected path</dt>
            <dd className="mono">{issue.path}</dd>
          </dl>
        )}
        {explanation && (
          <>
            <dl>
              <dt>Why it matters</dt>
              <dd>{explanation.why}</dd>
            </dl>
            <dl>
              <dt>Suggested fix</dt>
              <dd>{explanation.fix}</dd>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
