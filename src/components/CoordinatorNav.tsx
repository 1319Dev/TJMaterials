import { NavLink } from 'react-router-dom';

const links = [
  ['/daily', 'Daily receive'],
  ['/packing-slips', 'Packing slips'],
  ['/mtrs', 'MTRs'],
  ['/tracker', 'Tracker'],
] as const;

export function CoordinatorNav() {
  return (
    <nav aria-label="Coordinator" className="grid grid-cols-2 gap-2">
      {links.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex min-h-14 items-center justify-center border-2 border-pmi-border px-2 text-center text-base font-black ${
              isActive ? 'bg-pmi-ink text-pmi-sheet-text' : 'bg-pmi-card'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
