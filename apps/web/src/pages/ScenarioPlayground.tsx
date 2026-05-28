import { useState } from "react";
import { parseAgentSpecYaml, AgentSpecParseError } from "@agentspec/parser";
import type { AgentSpecDocument } from "@agentspec/spec";
import { compileAgentSpecGraph } from "@agentspec/grammar";
import { exampleAgents } from "../lib/examples";

export function ScenarioPlayground() {
  const [yaml, setYaml] = useState(exampleAgents[0].yaml);
  const [userMessage, setUserMessage] = useState("");
  const [doc, setDoc] = useState<AgentSpecDocument | null>(null);
  const [error, setError] = useState("");
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);

  function loadSpec() {
    setError("");
    setDoc(null);
    try {
      const parsed = parseAgentSpecYaml(yaml);
      setDoc(parsed.document);
    } catch (err) {
      if (err instanceof AgentSpecParseError) {
        setError(err.issues.map((i) => `${i.path}: ${i.message}`).join("; "));
      } else {
        setError(err instanceof Error ? err.message : "Failed to parse YAML.");
      }
    }
  }

  function evaluateMessage() {
    if (!doc || !userMessage.trim()) return;
    setError("");

    try {
      const input = userMessage.toLowerCase();
      const sortedRoutes = [...doc.routes].sort((a, b) => a.priority - b.priority);
      const evaluatedRoutes: EvaluatedRoute[] = [];
      let selectedRoute: string | undefined;
      let selectedTarget: string | undefined;

      for (const route of sortedRoutes) {
        const matchedTriggers = route.triggers.filter((t) =>
          input.includes(t.toLowerCase())
        );
        const matched = matchedTriggers.length > 0;
        evaluatedRoutes.push({
          name: route.name,
          triggers: route.triggers,
          matchedTriggers,
          matched,
          priority: route.priority,
          target: route.target,
        });

        if (matched && !selectedRoute) {
          selectedRoute = route.name;
          selectedTarget = route.target;
        }
      }

      // Determine handoff
      let handoff: string | undefined;
      if (selectedTarget?.startsWith("handoff:")) {
        handoff = selectedTarget.slice(8);
      } else if (selectedRoute) {
        // Check if there's a handoff condition match
        for (const h of doc.handoffs) {
          const conditionWords = h.condition.toLowerCase().split(/\s+/);
          if (conditionWords.some((w) => input.includes(w))) {
            handoff = h.name;
            break;
          }
        }
      }

      // Tool eligibility
      const toolChecks = doc.tools.map((tool) => ({
        tool: tool.name,
        eligible: selectedTarget === `tool:${tool.name}`,
        reason: selectedTarget === `tool:${tool.name}` ? "Selected route targets this tool." : "Selected route does not target this tool.",
      }));

      // Graph
      const graphResult = compileAgentSpecGraph(doc);

      setTraceResult({
        input: userMessage,
        selectedRoute,
        selectedTarget,
        handoff,
        evaluatedRoutes,
        toolChecks,
        nodeCount: graphResult.graph.nodes.length,
        edgeCount: graphResult.graph.edges.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed.");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Scenario Playground</h1>
        <p>
          Write a sample user message and see which route, handoff or tool path
          would be selected through deterministic evaluation.
        </p>
      </div>

      <div className="mb-6">
        <details open={!doc}>
          <summary style={{ cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, marginBottom: 8, color: "var(--color-text-secondary)" }}>
            Specification YAML
          </summary>
          <textarea
            className="textarea"
            style={{ minHeight: 180 }}
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            placeholder="Paste your .agentspec.yaml here..."
          />
          <div className="mt-4">
            <button className="btn btn-primary" onClick={loadSpec}>
              Load Specification
            </button>
          </div>
        </details>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {doc && (
        <div className="alert alert-success mb-4">
          Specification loaded: <strong>{doc.agent.name}</strong> ({doc.routes.length} routes, {doc.tools.length} tools, {doc.handoffs.length} handoffs)
        </div>
      )}

      {doc && (
        <div className="split-panel">
          <div>
            <div className="panel-header">
              <h2>User message</h2>
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 120 }}
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Type a sample user message to evaluate..."
            />
            <div className="mt-4">
              <button className="btn btn-primary" onClick={evaluateMessage} disabled={!userMessage.trim()}>
                Evaluate
              </button>
            </div>
          </div>

          <div>
            <div className="panel-header">
              <h2>Evaluation result</h2>
            </div>

            {traceResult ? (
              <div>
                <div className="card mb-4">
                  <div style={{ fontSize: "0.875rem", marginBottom: 8 }}>
                    <strong>Input:</strong> {traceResult.input}
                  </div>
                  <div style={{ fontSize: "0.875rem", marginBottom: 4 }}>
                    <strong>Selected route:</strong>{" "}
                    {traceResult.selectedRoute ? (
                      <span className="mono" style={{ color: "var(--color-success)" }}>{traceResult.selectedRoute}</span>
                    ) : (
                      <span style={{ color: "var(--color-error)" }}>No route matched</span>
                    )}
                  </div>
                  {traceResult.selectedTarget && (
                    <div style={{ fontSize: "0.875rem", marginBottom: 4 }}>
                      <strong>Target:</strong> <span className="mono">{traceResult.selectedTarget}</span>
                    </div>
                  )}
                  {traceResult.handoff && (
                    <div style={{ fontSize: "0.875rem" }}>
                      <strong>Handoff:</strong> <span className="mono">{traceResult.handoff}</span>
                    </div>
                  )}
                </div>

                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>Route evaluation</h3>
                <table className="results-table mb-4">
                  <thead>
                    <tr><th>Route</th><th>Priority</th><th>Matched</th><th>Triggers</th></tr>
                  </thead>
                  <tbody>
                    {traceResult.evaluatedRoutes.map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{r.name}</td>
                        <td>{r.priority}</td>
                        <td>
                          <span className={`badge ${r.matched ? "badge-success" : "badge-info"}`}>
                            {r.matched ? "Yes" : "No"}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.8125rem" }}>
                          {r.triggers.map((t, j) => (
                            <span key={j} style={{ marginRight: 6, color: r.matchedTriggers.includes(t) ? "var(--color-success)" : "var(--color-text-muted)" }}>
                              {t}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>Tool eligibility</h3>
                <table className="results-table">
                  <thead><tr><th>Tool</th><th>Eligible</th><th>Reason</th></tr></thead>
                  <tbody>
                    {traceResult.toolChecks.map((t, i) => (
                      <tr key={i}>
                        <td className="mono">{t.tool}</td>
                        <td><span className={`badge ${t.eligible ? "badge-success" : "badge-info"}`}>{t.eligible ? "Yes" : "No"}</span></td>
                        <td style={{ fontSize: "0.8125rem" }}>{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>Type a message and press Evaluate to see the routing trace.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------- Types --------- */

interface EvaluatedRoute {
  name: string;
  triggers: string[];
  matchedTriggers: string[];
  matched: boolean;
  priority: number;
  target: string;
}

interface TraceResult {
  input: string;
  selectedRoute?: string;
  selectedTarget?: string;
  handoff?: string;
  evaluatedRoutes: EvaluatedRoute[];
  toolChecks: Array<{ tool: string; eligible: boolean; reason: string }>;
  nodeCount: number;
  edgeCount: number;
}
