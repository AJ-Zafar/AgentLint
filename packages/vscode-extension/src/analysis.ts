import { AgentSpecParseError, parseAgentSpecYaml } from "@agentspec/parser";
import { lintAgentSpec, type LintIssue } from "@agentspec/linter";

export type ExtensionDiagnosticSeverity = "error" | "warning" | "info";

export type ExtensionDiagnostic = {
  source: "agentspec";
  severity: ExtensionDiagnosticSeverity;
  message: string;
  path: string;
  suggestion?: string;
  code?: string;
};

export type AgentSpecAnalysis = {
  valid: boolean;
  diagnostics: ExtensionDiagnostic[];
  validationDiagnostics: ExtensionDiagnostic[];
  lintDiagnostics: ExtensionDiagnostic[];
};

export function analyzeAgentSpecText(contents: string, source = "inline"): AgentSpecAnalysis {
  try {
    const parsed = parseAgentSpecYaml(contents, { source });
    const lintDiagnostics = lintAgentSpec(parsed.document).issues.map(lintIssueToDiagnostic);

    return {
      valid: true,
      diagnostics: lintDiagnostics,
      validationDiagnostics: [],
      lintDiagnostics
    };
  } catch (error) {
    if (error instanceof AgentSpecParseError) {
      const validationDiagnostics = error.issues.map((issue) => ({
        source: "agentspec" as const,
        severity: "error" as const,
        message: issue.message,
        path: issue.path || "$",
        code: "validation"
      }));

      return {
        valid: false,
        diagnostics: validationDiagnostics,
        validationDiagnostics,
        lintDiagnostics: []
      };
    }

    throw error;
  }
}

export function lintIssueToDiagnostic(issue: LintIssue): ExtensionDiagnostic {
  return {
    source: "agentspec",
    severity: issue.severity,
    message: `${issue.message} Suggestion: ${issue.suggestion}`,
    path: issue.path,
    suggestion: issue.suggestion,
    code: issue.ruleId
  };
}
