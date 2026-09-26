import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/receive', label: 'Receive', icon: ReceiveIcon },
  { to: '/inventory', label: 'Inventory', icon: InventoryIcon },
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/more', label: 'More', icon: MoreIcon },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="pmi-tabbar fixed inset-x-0 bottom-0 z-30 border-t-2 border-pmi-border bg-pmi-nav pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-bold ${
                  isActive ? 'text-pmi-accent' : 'text-pmi-text'
                }`
              }
            >
              <item.icon />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
}

function ReceiveIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="6" rx="1" />
      <rect x="4" y="14" width="16" height="6" rx="1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}
