import { useNavigate } from "react-router-dom";

export function Landing() {
  const navigate = useNavigate();

  return (
    <>
      <section className="hero">
        <h1>Validate your AI agent instructions before they reach production</h1>
        <p>
          Open-source linting, testing and governance for AI agent specifications.
          No installation required — run entirely in your browser.
        </p>
        <div className="hero-cta">
          <button className="btn btn-primary" onClick={() => navigate("/builder")}>
            Paste your instructions
          </button>
          <button className="btn" onClick={() => navigate("/examples")}>
            Try an example
          </button>
        </div>
      </section>

      <section className="page">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontSize: "1rem", color: "var(--color-text-secondary)", maxWidth: 640, margin: "0 auto" }}>
            Agent Lint gives you structured validation, lint rules, behavioural testing
            and governance reports for AI agent instruction sets — right here in the browser,
            before you open an IDE.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>Instruction Builder</h3>
            <p>
              Paste loose natural-language agent instructions and convert them into
              a structured Agent Lint YAML specification with ambiguity warnings.
            </p>
          </div>
          <div className="feature-card">
            <h3>YAML Workspace</h3>
            <p>
              Full-featured code editor with syntax highlighting, schema validation
              and live lint diagnostics as you type.
            </p>
          </div>
          <div className="feature-card">
            <h3>Analysis Dashboard</h3>
            <p>
              Validate, lint, test, replay scenarios, view behaviour graphs,
              measure coverage and diff specification changes.
            </p>
          </div>
          <div className="feature-card">
            <h3>Scenario Playground</h3>
            <p>
              Write a sample user message and see which route, handoff or tool
              path would be selected with a deterministic replay trace.
            </p>
          </div>
          <div className="feature-card">
            <h3>Governance Reports</h3>
            <p>
              Export detailed evidence reports in JSON, Markdown or standalone HTML
              for governance review and audit trails.
            </p>
          </div>
          <div className="feature-card">
            <h3>Sample Agents</h3>
            <p>
              Pre-built examples covering HR, customer support, public sector,
              Copilot Studio and event management use cases.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
