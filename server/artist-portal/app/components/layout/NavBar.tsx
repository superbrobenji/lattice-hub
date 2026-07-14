import { NavLink } from "react-router";

const NAV_ITEMS = [
  { to: "/", label: "Live Tracker", end: true },
  { to: "/zones", label: "Zones", end: false },
  { to: "/enrollments", label: "Enrollments", end: false },
  { to: "/api-docs", label: "API Reference", end: false },
  { to: "/guides", label: "Integration Guides", end: false },
];

export function NavBar() {
  return (
    <nav className="bg-surface border-b border-border px-6 h-14 flex items-center gap-1">
      <span className="text-accent font-semibold text-sm tracking-tight mr-6">Lattice</span>
      {NAV_ITEMS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `px-3 py-1.5 rounded text-sm transition-colors ${
              isActive
                ? "bg-elevated text-white"
                : "text-muted hover:text-white hover:bg-elevated"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
