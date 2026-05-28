import { useState, useCallback } from "react";
import { parseAgentSpecYaml, AgentSpecParseError } from "@agentspec/parser";
import { lintAgentSpec } from "@agentspec/linter";
import type { LintIssue } from "@agentspec/linter";
import { runAgentSpecTests } from "@agentspec/test-runner";
import type { TestRunResult, TestCaseResult, TestFailure } from "@agentspec/test-runner";
import { analyseBehaviouralCoverage } from "@agentspec/coverage";
import type { BehaviouralCoverageReport } from "@agentspec/coverage";
import { compileAgentSpecGraph } from "@agentspec/grammar";
import type { GraphCompilationResult } from "@agentspec/grammar";
import { replayScenario, renderReplayMermaid } from "@agentspec/replay";
import type { ReplayResult } from "@agentspec/replay";
import { diffAgentSpecs } from "@agentspec/diff";
import type { BehavioralDiffResult, BehavioralChange } from "@agentspec/diff";
import { generateGovernanceMarkdownReport } from "@agentspec/report";
import type { AgentSpecDocument } from "@agentspec/spec";
import { FindingCard } from "../components/FindingCard";
import { ExportMenu } from "../components/ExportMenu";
import { exportAsJson, exportAsMarkdown, exportAsHtml } from "../lib/export";
import { exampleAgents } from "../lib/examples";

type Tab = "validate" | "lint" | "test" | "replay" | "graph" | "coverage" | "diff" | "report";

export function AnalysisDashboard() {
  const [yaml, setYaml] = useState(() => {
    const stored = sessionStorage.getItem("agentlint-yaml");
    if (stored) {
      sessionStorage.removeItem("agentlint-yaml");
      return stored;
    }
    return exampleAgents[0].yaml;
  });
  const [diffYaml, setDiffYaml] = useState("");
  const [tab, setTab] = useState<Tab>("validate");

  // Results
  const [doc, setDoc] = useState<AgentSpecDocument | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [lintIssues, setLintIssues] = useState<LintIssue[]>([]);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [coverageResult, setCoverageResult] = useState<BehaviouralCoverageReport | null>(null);
  const [graphResult, setGraphResult] = useState<GraphCompilationResult | null>(null);
  const [replayResults, setReplayResults] = useState<ReplayResult[]>([]);
  const [diffResult, setDiffResult] = useState<BehavioralDiffResult | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState("");
  const [error, setError] = useState("");

  const parseSpec = useCallback((content: string): AgentSpecDocument | null => {
    try {
      const parsed = parseAgentSpecYaml(content);
      setParseErrors([]);
      return parsed.document;
    } catch (err) {
      if (err instanceof AgentSpecParseError) {
        setParseErrors(err.issues.map((i) => `${i.path}: ${i.message}`));
      } else {
        setParseErrors([err instanceof Error ? err.message : "Parse failed."]);
      }
      return null;
    }
  }, []);

  function runAll() {
    setError("");
    setLintIssues([]);
    setTestResult(null);
    setCoverageResult(null);
    setGraphResult(null);
    setReplayResults([]);
    setDiffResult(null);
    setReportMarkdown("");

    const parsed = parseSpec(yaml);
    if (!parsed) return;
    setDoc(parsed);

    try {
      setLintIssues(lintAgentSpec(parsed).issues);
      setTestResult(runAgentSpecTests(parsed));
      setCoverageResult(analyseBehaviouralCoverage(parsed));
      setGraphResult(compileAgentSpecGraph(parsed));

      // Replay all scenarios
      const scenarios = parsed.tests?.map((t) => t.name) ?? [];
      const replays: ReplayResult[] = [];
      for (const name of scenarios) {
        try {
          replays.push(replayScenario(parsed, name));
        } catch {
          // skip scenarios that fail
        }
      }
      setReplayResults(replays);

      setReportMarkdown(generateGovernanceMarkdownReport(parsed));

      // Diff if provided
      if (diffYaml.trim()) {
        const oldDoc = parseSpec(diffYaml);
        if (oldDoc) {
          setDiffResult(diffAgentSpecs(oldDoc, parsed));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "validate", label: "Validate" },
    { key: "lint", label: "Lint" },
    { key: "test", label: "Test" },
    { key: "replay", label: "Replay" },
    { key: "graph", label: "Graph" },
    { key: "coverage", label: "Coverage" },
    { key: "diff", label: "Diff" },
    { key: "report", label: "Report" },
  ];

  function getExportData() {
    return {
      parseErrors,
      lintIssues,
      testResult,
      coverageResult,
      graphResult: graphResult ? { diagnostics: graphResult.diagnostics, nodeCount: graphResult.graph.nodes.length, edgeCount: graphResult.graph.edges.length } : null,
      replayResults,
      diffResult,
    };
  }

  return (
    <div className="page-wide">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1>Analysis Dashboard</h1>
            <p>Run the full Agent Lint analysis suite against your specification.</p>
          </div>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={runAll}>
              Run Analysis
            </button>
            {reportMarkdown && (
              <ExportMenu
                onExportJson={() => exportAsJson(getExportData())}
                onExportMarkdown={() => exportAsMarkdown(reportMarkdown)}
                onExportHtml={() => exportAsHtml(reportMarkdown)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <details>
          <summary style={{ cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, marginBottom: 8, color: "var(--color-text-secondary)" }}>
            Paste specification YAML (click to expand)
          </summary>
          <textarea
            className="textarea"
            style={{ minHeight: 200 }}
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            placeholder="Paste your .agentspec.yaml here..."
          />
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              Optional: paste old specification for diff comparison
            </summary>
            <textarea
              className="textarea"
              style={{ minHeight: 120, marginTop: 8 }}
              value={diffYaml}
              onChange={(e) => setDiffYaml(e.target.value)}
              placeholder="Paste an older version of the specification to compare..."
            />
          </details>
        </details>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "tab-active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="scroll-y">
        {tab === "validate" && <ValidateTab errors={parseErrors} doc={doc} />}
        {tab === "lint" && <LintTab issues={lintIssues} />}
        {tab === "test" && <TestTab result={testResult} />}
        {tab === "replay" && <ReplayTab results={replayResults} />}
        {tab === "graph" && <GraphTab result={graphResult} />}
        {tab === "coverage" && <CoverageTab result={coverageResult} />}
        {tab === "diff" && <DiffTab result={diffResult} />}
        {tab === "report" && <ReportTab markdown={reportMarkdown} />}
      </div>
    </div>
  );
}

/* --------- Sub-tab components --------- */

function ValidateTab({ errors, doc }: { errors: string[]; doc: AgentSpecDocument | null }) {
  if (!doc && errors.length === 0) return <EmptyState text="Run the analysis to validate the specification." />;
  if (errors.length > 0) {
    return (
      <div className="alert alert-error">
        <strong>Validation failed:</strong>
        <ul style={{ margin: "8px 0 0 16px", fontSize: "0.875rem" }}>
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    );
  }
  return (
    <div>
      <div className="alert alert-success mb-4">Specification is valid.</div>
      <div className="stat-grid">
        <StatCard label="Routes" value={doc!.routes.length} />
        <StatCard label="Tools" value={doc!.tools.length} />
        <StatCard label="Handoffs" value={doc!.handoffs.length} />
        <StatCard label="Tests" value={doc!.tests?.length ?? 0} />
      </div>
    </div>
  );
}

function LintTab({ issues }: { issues: LintIssue[] }) {
  if (issues.length === 0) return <EmptyState text="No lint issues found. Run the analysis to check." />;
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const info = issues.filter((i) => i.severity === "info");
  return (
    <div>
      <div className="stat-grid mb-4">
        <StatCard label="Errors" value={errors.length} color="var(--color-error)" />
        <StatCard label="Warnings" value={warnings.length} color="var(--color-warning)" />
        <StatCard label="Info" value={info.length} color="var(--color-info)" />
      </div>
      {issues.map((issue, i) => <FindingCard key={i} issue={issue} />)}
    </div>
  );
}

function TestTab({ result }: { result: TestRunResult | null }) {
  if (!result) return <EmptyState text="Run the analysis to execute tests." />;
  return (
    <div>
      <div className="stat-grid mb-4">
        <StatCard label="Total" value={result.summary.total} />
        <StatCard label="Passed" value={result.summary.passed} color="var(--color-success)" />
        <StatCard label="Failed" value={result.summary.failed} color="var(--color-error)" />
      </div>
      <table className="results-table">
        <thead>
          <tr>
            <th>Test</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {result.tests.map((r: TestCaseResult, i: number) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{r.name}</td>
              <td>
                <span className={`badge ${r.passed ? "badge-success" : "badge-error"}`}>
                  {r.passed ? "Passed" : "Failed"}
                </span>
              </td>
              <td style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                {r.failures.length > 0 ? r.failures.map((f: TestFailure) => f.reason).join("; ") : "All assertions passed."}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReplayTab({ results }: { results: ReplayResult[] }) {
  const [selected, setSelected] = useState(0);
  if (results.length === 0) return <EmptyState text="Run the analysis to replay scenarios." />;
  const r = results[selected];
  return (
    <div>
      <div className="mb-4">
        <select className="select" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
          {results.map((res, i) => (
            <option key={i} value={i}>{res.scenario}</option>
          ))}
        </select>
      </div>
      <div className="card mb-4">
        <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: 4 }}>
          <strong>Input:</strong> {r.input}
        </div>
        {r.selectedRoute && (
          <div style={{ fontSize: "0.8125rem" }}>
            <strong>Selected route:</strong> <span className="mono">{r.selectedRoute}</span>
          </div>
        )}
      </div>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 12 }}>Trace</h3>
      <ol className="trace-list">
        {r.trace.map((step) => (
          <li key={step.step} className="trace-step">
            <span className="trace-step-num">{step.step}</span>
            <div>
              <span className="trace-step-kind">{step.kind}</span>
              <span className="mono">{step.node}</span>
              {" — "}
              <span style={{ color: step.result === "matched" || step.result === "selected" || step.result === "passed" || step.result === "eligible" ? "var(--color-success)" : "var(--color-text-secondary)" }}>
                {step.result}
              </span>
            </div>
          </li>
        ))}
      </ol>
      {r.rejectedRoutes.length > 0 && (
        <div className="mt-4">
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>Rejected routes</h3>
          <table className="results-table">
            <thead><tr><th>Route</th><th>Reason</th></tr></thead>
            <tbody>
              {r.rejectedRoutes.map((rr, i) => (
                <tr key={i}><td className="mono">{rr.route}</td><td style={{ fontSize: "0.8125rem" }}>{rr.reason}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4">
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>Mermaid diagram</h3>
        <pre style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 16, fontSize: "0.8125rem", overflow: "auto", fontFamily: "var(--font-mono)" }}>
          {renderReplayMermaid(r)}
        </pre>
      </div>
    </div>
  );
}

function GraphTab({ result }: { result: GraphCompilationResult | null }) {
  if (!result) return <EmptyState text="Run the analysis to compile the behaviour graph." />;
  return (
    <div>
      <div className="stat-grid mb-4">
        <StatCard label="Nodes" value={result.graph.nodes.length} />
        <StatCard label="Edges" value={result.graph.edges.length} />
        <StatCard label="Diagnostics" value={result.diagnostics.length} color={result.diagnostics.length > 0 ? "var(--color-warning)" : undefined} />
      </div>
      {result.diagnostics.length > 0 && (
        <div className="mb-4">
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>Graph diagnostics</h3>
          {result.diagnostics.map((d, i) => (
            <div key={i} className={`finding-card finding-card-${d.severity}`}>
              <div className="finding-header">
                <span className={`badge ${d.severity === "error" ? "badge-error" : "badge-warning"}`}>{d.severity}</span>
                <span className="finding-title">{d.code}</span>
              </div>
              <div className="finding-body">
                <p>{d.message}</p>
                <dl><dt>Path</dt><dd className="mono">{d.path}</dd></dl>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 12 }}>Nodes</h3>
      <table className="results-table mb-4">
        <thead><tr><th>ID</th><th>Kind</th><th>Label</th></tr></thead>
        <tbody>
          {result.graph.nodes.map((n, i) => (
            <tr key={i}><td className="mono">{n.id}</td><td><span className="badge badge-info">{n.kind}</span></td><td>{n.label}</td></tr>
          ))}
        </tbody>
      </table>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 12 }}>Edges</h3>
      <table className="results-table">
        <thead><tr><th>From</th><th>To</th><th>Kind</th><th>Label</th></tr></thead>
        <tbody>
          {result.graph.edges.map((e, i) => (
            <tr key={i}><td className="mono">{e.from}</td><td className="mono">{e.to}</td><td style={{ fontSize: "0.8125rem" }}>{e.kind}</td><td>{e.label ?? ""}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoverageTab({ result }: { result: BehaviouralCoverageReport | null }) {
  if (!result) return <EmptyState text="Run the analysis to calculate coverage." />;
  const metrics = [
    { label: "Routes", ...result.routeCoverage },
    { label: "Handoffs", ...result.handoffCoverage },
    { label: "Tools", ...result.toolCoverage },
    { label: "Constraints", ...result.constraintCoverage },
    { label: "Fallback", ...result.fallbackCoverage },
  ];
  return (
    <div>
      <div className="stat-grid mb-4">
        <StatCard label="Overall Coverage" value={`${result.overall}%`} color={result.overall >= 80 ? "var(--color-success)" : result.overall >= 50 ? "var(--color-warning)" : "var(--color-error)"} />
      </div>
      <table className="results-table mb-4">
        <thead><tr><th>Category</th><th>Covered</th><th>Total</th><th>Percentage</th><th>Uncovered</th></tr></thead>
        <tbody>
          {metrics.map((m, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{m.label}</td>
              <td>{m.covered}</td>
              <td>{m.total}</td>
              <td><span className={m.percentage >= 80 ? "text-success" : m.percentage >= 50 ? "text-warning" : "text-error"}>{m.percentage}%</span></td>
              <td className="mono" style={{ fontSize: "0.8125rem" }}>{m.uncovered.join(", ") || "\u2014"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.uncoveredBranches.length > 0 && (
        <div>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>Uncovered branches</h3>
          <ul style={{ fontSize: "0.875rem", paddingLeft: 20, color: "var(--color-text-secondary)" }}>
            {result.uncoveredBranches.map((r: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
          </ul>
        </div>
      )}
      {result.recommendedTestScenarios.length > 0 && (
        <div className="mt-4">
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>Recommended test scenarios</h3>
          <table className="results-table">
            <thead><tr><th>Scenario</th><th>Reason</th></tr></thead>
            <tbody>
              {result.recommendedTestScenarios.map((s: { name: string; reason: string }, i: number) => (
                <tr key={i}><td>{s.name}</td><td style={{ fontSize: "0.8125rem" }}>{s.reason}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DiffTab({ result }: { result: BehavioralDiffResult | null }) {
  if (!result) return <EmptyState text="Paste an old specification alongside the current one, then run analysis to see the diff." />;
  return (
    <div>
      <div className="stat-grid mb-4">
        <StatCard label="Impact" value={result.impact} color={result.impact === "breaking" ? "var(--color-error)" : result.impact === "high" ? "var(--color-warning)" : "var(--color-success)"} />
        <StatCard label="Changes" value={result.changes.length} />
      </div>
      <div className="alert alert-info mb-4">
        <strong>Summary:</strong> {result.summary.total} change{result.summary.total !== 1 ? "s" : ""} detected
        ({result.summary.breaking} breaking, {result.summary.high} high, {result.summary.medium} medium, {result.summary.low} low).
      </div>
      <table className="results-table">
        <thead><tr><th>Type</th><th>Impact</th><th>Message</th><th>Path</th></tr></thead>
        <tbody>
          {result.changes.map((c: BehavioralChange, i: number) => (
            <tr key={i}>
              <td style={{ fontSize: "0.8125rem" }}>{c.type}</td>
              <td><span className={`badge ${c.impact === "breaking" || c.impact === "high" ? "badge-error" : c.impact === "medium" ? "badge-warning" : "badge-info"}`}>{c.impact}</span></td>
              <td style={{ fontSize: "0.8125rem" }}>{c.message}</td>
              <td className="mono" style={{ fontSize: "0.8125rem" }}>{c.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportTab({ markdown }: { markdown: string }) {
  if (!markdown) return <EmptyState text="Run the analysis to generate a governance report." />;
  return (
    <pre style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 20, fontSize: "0.8125rem", overflow: "auto", maxHeight: 600, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
      {markdown}
    </pre>
  );
}

/* --------- Utilities --------- */

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><p>{text}</p></div>;
}
