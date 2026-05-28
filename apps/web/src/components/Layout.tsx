import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <>
      <nav className="nav">
        <NavLink to="/" className="nav-logo" end>
          Agent Lint
        </NavLink>
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
