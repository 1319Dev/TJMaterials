import { Link } from 'react-router-dom';

const links = [
  ['/tally', 'Pipe tally'],
  ['/fittings', 'Fittings'],
  ['/flanges', 'Flanges'],
  ['/valves', 'Valves'],
] as const;

export function SpecialtyNav() {
  return (
    <nav aria-label="Tally and components" className="grid grid-cols-2 gap-2">
      {links.map(([to, label]) => (
        <Link
          key={to}
          to={to}
          className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-pmi-border bg-pmi-card px-3 text-center text-base font-bold"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
