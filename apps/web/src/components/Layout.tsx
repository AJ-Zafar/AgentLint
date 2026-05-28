import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <>
      <nav className="nav">
        <NavLink to="/" className="nav-logo" end>
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
