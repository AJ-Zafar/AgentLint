import { useNavigate } from "react-router-dom";
import { exampleAgents } from "../lib/examples";

export function Examples() {
  const navigate = useNavigate();

  function openInWorkspace(yaml: string) {
    sessionStorage.setItem("agentlint-yaml", yaml);
    navigate("/workspace");
  }

  function openInAnalysis(yaml: string) {
    sessionStorage.setItem("agentlint-yaml", yaml);
    navigate("/analysis");
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Example Agents</h1>
        <p>
          Pre-built Agent Lint specifications covering common enterprise use cases.
          Use these as starting points or to explore the analysis features.
        </p>
      </div>

      <div className="example-list">
        {exampleAgents.map((example) => (
          <div key={example.id} className="card">
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>
                {example.name}
              </h3>
              <span className="badge badge-info" style={{ marginBottom: 8 }}>
                {example.domain}
              </span>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: 8 }}>
                {example.description}
              </p>
            </div>
            <div className="btn-group">
              <button className="btn btn-sm" onClick={() => openInWorkspace(example.yaml)}>
                Open in Workspace
              </button>
              <button className="btn btn-sm" onClick={() => openInAnalysis(example.yaml)}>
                Analyse
              </button>
              <button
                className="btn btn-sm"
                onClick={() => navigator.clipboard.writeText(example.yaml)}
              >
                Copy YAML
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
