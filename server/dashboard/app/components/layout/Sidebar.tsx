import { NavLink } from "react-router";

interface NavItem {
  label: string;
  to: string;
}

const MESH_LINKS: NavItem[] = [
  { label: "Overview", to: "/" },
  { label: "Nodes", to: "/nodes" },
  { label: "Enrollments", to: "/enrollments" },
  { label: "Server", to: "/server" },
];

const INFRA_LINKS: NavItem[] = [
  { label: "Infrastructure", to: "/infrastructure" },
  { label: "Events", to: "/events" },
];

function NavSection({ title, links }: { title: string; links: NavItem[] }) {
  return (
    <div>
      <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        {title}
      </p>
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-muted hover:bg-elevated hover:text-text"
                }`
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] bg-surface border-r border-border flex flex-col z-10">
      <div className="px-4 py-5 border-b border-border">
        <span className="text-sm font-semibold text-text">Lattice Hub</span>
        <span className="ml-2 text-xs text-muted">Admin</span>
      </div>
      <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
        <NavSection title="Mesh" links={MESH_LINKS} />
        <NavSection title="Infra" links={INFRA_LINKS} />
      </nav>
      <form action="/logout" method="post" className="p-3 border-t border-border">
        <button
          type="submit"
          className="w-full px-4 py-2 text-sm text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors text-left"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
