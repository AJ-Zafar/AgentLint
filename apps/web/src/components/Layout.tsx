import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Add shadow on scroll
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 4); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav className={`nav${scrolled ? " nav-scrolled" : ""}`}>
        <NavLink to="/" className="nav-logo" end>
          <span className="nav-logo-mark">AL</span>
          Agent Lint
        </NavLink>
        <button
          className="nav-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <span className={`nav-toggle-icon ${menuOpen ? "nav-toggle-open" : ""}`} />
        </button>
        {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}
        <div className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}>
          <NavLink to="/builder" className={navClass}>
            Instruction Builder
          </NavLink>
          <NavLink to="/workspace" className={navClass}>
            YAML Workspace
          </NavLink>
          <NavLink to="/analysis" className={navClass}>
            Analysis
          </NavLink>
          <NavLink to="/playground" className={navClass}>
            Playground
          </NavLink>
          <NavLink to="/examples" className={navClass}>
            Examples
          </NavLink>
        </div>
        <div className="nav-spacer" />
        <div className="nav-external">
          <a
            href="https://github.com/AJ-Zafar/AgentLint"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github-link"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
                .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
                .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
                0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : "";
}

