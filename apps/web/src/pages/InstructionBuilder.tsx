import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { compileInstructionsToAgentSpec } from "@agentspec/compiler";

export function InstructionBuilder() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [compiledYaml, setCompiledYaml] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");

  function handleCompile() {
    if (!input.trim()) return;
    setError("");
    try {
      const result = compileInstructionsToAgentSpec(input);
      setCompiledYaml(result.yaml);
      setWarnings(result.warnings);
      setConfidence(result.confidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compilation failed.");
    }
  }

  function handleOpenInWorkspace() {
    // Store YAML in sessionStorage so the workspace can pick it up
    sessionStorage.setItem("agentlint-yaml", compiledYaml);
    navigate("/workspace");
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Instruction Builder</h1>
        <p>
          Paste loose natural-language agent instructions below. Agent Lint will
          compile them into a structured YAML specification.
        </p>
      </div>

      <div className="split-panel">
        <div>
          <div className="panel-header">
            <h2>Natural-language instructions</h2>
          </div>
          <textarea
            className="textarea"
            style={{ minHeight: 360 }}
            placeholder={`Example:\nYou are an HR assistant. Answer questions about leave policy, benefits and sickness absence. Escalate harassment and discrimination to an HR partner. Do not give legal advice. Do not access medical records.`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="mt-4">
            <button className="btn btn-primary" onClick={handleCompile} disabled={!input.trim()}>
              Compile to YAML
            </button>
          </div>
        </div>

        <div>
          <div className="panel-header">
            <h2>Generated specification</h2>
            {compiledYaml && (
              <div className="btn-group">
                <button className="btn btn-sm" onClick={handleOpenInWorkspace}>
                  Open in Workspace
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => navigator.clipboard.writeText(compiledYaml)}
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {warnings.length > 0 && (
            <div className="alert alert-info" style={{ marginBottom: 12 }}>
              <strong>Ambiguity warnings:</strong>
              <ul style={{ margin: "8px 0 0 16px", fontSize: "0.875rem" }}>
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {confidence && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: 8 }}>
                <strong>Confidence scores:</strong>
              </div>
              <div className="stat-grid">
                {Object.entries(confidence).map(([key, value]) => (
                  <div className="stat-card" key={key}>
                    <div className="stat-value" style={{ color: value >= 0.7 ? "var(--color-success)" : value >= 0.4 ? "var(--color-warning)" : "var(--color-error)" }}>
                      {Math.round(value * 100)}%
                    </div>
                    <div className="stat-label">{key}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {compiledYaml ? (
            <pre
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                padding: 16,
                fontSize: "0.8125rem",
                overflow: "auto",
                maxHeight: 500,
                whiteSpace: "pre-wrap",
                fontFamily: "var(--font-mono)",
              }}
            >
              {compiledYaml}
            </pre>
          ) : (
            <div className="empty-state">
              <p>Paste your agent instructions on the left and press Compile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
