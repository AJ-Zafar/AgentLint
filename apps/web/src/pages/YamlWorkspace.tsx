import { useState, useEffect, useCallback, lazy, Suspense } from "react";
const Editor = lazy(() => import("@monaco-editor/react"));
import { parseAgentSpecYaml, AgentSpecParseError } from "@agentspec/parser";
import { lintAgentSpec } from "@agentspec/linter";
import type { LintIssue } from "@agentspec/linter";
import { FindingCard } from "../components/FindingCard";
import { copyToClipboard, downloadFile } from "../lib/export";
import { exampleAgents } from "../lib/examples";

const DEFAULT_YAML = exampleAgents[0].yaml;

export function YamlWorkspace() {
  const [yaml, setYaml] = useState(() => {
    const stored = sessionStorage.getItem("agentlint-yaml");
    if (stored) {
      sessionStorage.removeItem("agentlint-yaml");
      return stored;
    }
    return DEFAULT_YAML;
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [lintIssues, setLintIssues] = useState<LintIssue[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const runAnalysis = useCallback((content: string) => {
    setValidationErrors([]);
    setLintIssues([]);
    setIsValid(null);

    if (!content.trim()) return;

    try {
      const parsed = parseAgentSpecYaml(content);
      setIsValid(true);
      const lintResult = lintAgentSpec(parsed.document);
      setLintIssues(lintResult.issues);
    } catch (err) {
      if (err instanceof AgentSpecParseError) {
        setValidationErrors(err.issues.map((i) => `${i.path}: ${i.message}`));
      } else {
        setValidationErrors([err instanceof Error ? err.message : "Failed to parse YAML."]);
      }
      setIsValid(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runAnalysis(yaml), 400);
    return () => clearTimeout(timer);
  }, [yaml, runAnalysis]);

  return (
    <div className="page-wide">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1>YAML Workspace</h1>
            <p>Edit your Agent Lint specification with live validation and lint feedback.</p>
          </div>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={() => copyToClipboard(yaml)}>
              Copy
            </button>
            <button className="btn btn-sm" onClick={() => downloadFile(yaml, "agent.agentspec.yaml", "text/yaml")}>
              Download
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                sessionStorage.setItem("agentlint-yaml", yaml);
                window.location.hash = "#/analysis";
              }}
            >
              Analyse
            </button>
          </div>
        </div>
      </div>

      <div className="split-panel">
        <div>
          <div className="panel-header">
            <h2>Editor</h2>
            {isValid === true && (
              <span className="badge badge-success">Valid</span>
            )}
            {isValid === false && (
              <span className="badge badge-error">Invalid</span>
            )}
          </div>
          <div className="editor-wrapper" style={{ height: 560 }}>
            <Suspense fallback={<div className="empty-state"><p>Loading editor...</p></div>}>
              <Editor
                height="100%"
                defaultLanguage="yaml"
                value={yaml}
                onChange={(value) => setYaml(value ?? "")}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  automaticLayout: true,
                }}
              />
            </Suspense>
          </div>
        </div>

        <div>
          <div className="panel-header">
            <h2>Diagnostics</h2>
            {lintIssues.length > 0 && (
              <span className="badge badge-warning">{lintIssues.length} issue{lintIssues.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          <div className="scroll-y">
            {validationErrors.length > 0 && (
              <div className="alert alert-error mb-4">
                <strong>Validation errors:</strong>
                <ul style={{ margin: "8px 0 0 16px", fontSize: "0.875rem" }}>
                  {validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {lintIssues.length > 0
              ? lintIssues.map((issue, i) => <FindingCard key={i} issue={issue} />)
              : isValid === true && (
                  <div className="alert alert-success">
                    No issues found. The specification is valid and passes all lint rules.
                  </div>
                )}

            {isValid === null && (
              <div className="empty-state">
                <p>Start typing to see live diagnostics.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
