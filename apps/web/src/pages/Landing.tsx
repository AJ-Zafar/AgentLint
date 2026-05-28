import { useNavigate } from "react-router-dom";

export function Landing() {
  const navigate = useNavigate();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Open Source · MIT License
          </div>

          <h1>
            Validate your AI agent<br />
            <span className="gradient-word">instructions</span> before<br />
            they reach production
          </h1>

          <p>
            Open-source linting, testing and governance for AI agent
            specifications. Run entirely in your browser — no installation
            required.
          </p>

          <div className="hero-cta">
            <button className="btn btn-primary" onClick={() => navigate("/builder")}>
              Paste your instructions
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
            <button className="btn-hero-outline" onClick={() => navigate("/examples")}>
              Try an example
            </button>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">6+</div>
              <div className="hero-stat-label">Sample agents</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">20+</div>
              <div className="hero-stat-label">Lint rules</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">100%</div>
              <div className="hero-stat-label">Browser-native</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">MIT</div>
              <div className="hero-stat-label">Open source</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="features-section">
        <div className="features-section-inner">
          <div className="section-label">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1a6 6 0 110 12A6 6 0 018 2zm0 3a1 1 0 100 2 1 1 0 000-2zm-1 3h2v4H7V8z" />
            </svg>
            What's included
          </div>
          <h2 className="section-title">
            Everything you need to ship<br />
            reliable AI agents
          </h2>
          <p className="section-desc">
            Agent Lint gives you structured validation, lint rules, behavioural
            testing and governance reports — right in the browser, before you
            open an IDE.
          </p>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">🔨</div>
              <h3>Instruction Builder</h3>
              <p>
                Paste loose natural-language agent instructions and convert them
                into a structured Agent Lint YAML specification with ambiguity
                warnings.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3>YAML Workspace</h3>
              <p>
                Full-featured code editor with syntax highlighting, schema
                validation and live lint diagnostics as you type.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Analysis Dashboard</h3>
              <p>
                Validate, lint, test, replay scenarios, view behaviour graphs,
                measure coverage and diff specification changes.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎮</div>
              <h3>Scenario Playground</h3>
              <p>
                Write a sample user message and see which route, handoff or tool
                path would be selected with a deterministic replay trace.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>Governance Reports</h3>
              <p>
                Export detailed evidence reports in JSON, Markdown or standalone
                HTML for governance review and audit trails.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🗂️</div>
              <h3>Sample Agents</h3>
              <p>
                Pre-built examples covering HR, customer support, public sector,
                Copilot Studio and event management use cases.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

