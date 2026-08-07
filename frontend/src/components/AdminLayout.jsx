import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../admin/AdminAuthContext';
import { adminApi } from '../api/client';
import ThemeToggle from './ThemeToggle';

const SUMMARY_POLL_MS = 20_000;

const navLinkClass = ({ isActive }) =>
  `flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-paper-2 text-ink' : 'text-muted hover:bg-paper-2 hover:text-ink-2'
  }`;

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="flex h-4.5 min-w-[18px] flex-none items-center justify-center rounded-full bg-fault px-1 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavLinks({ summary, onNavigate }) {
  return (
    <nav className="flex flex-col gap-0.5">
      <NavLink to="/admin/queue" className={navLinkClass} onClick={onNavigate}>
        <span>Queue</span>
        <Badge count={summary?.actionableOrders} />
      </NavLink>
      <NavLink to="/admin/history" className={navLinkClass} onClick={onNavigate}>
        <span>History</span>
      </NavLink>
      <NavLink to="/admin/reviews" className={navLinkClass} onClick={onNavigate}>
        <span>Reviews</span>
        <Badge count={summary?.pendingReviews} />
      </NavLink>
      <NavLink to="/admin/notify-requests" className={navLinkClass} onClick={onNavigate}>
        <span>Notify list</span>
        <Badge count={summary?.pendingNotifyRequests} />
      </NavLink>
      <NavLink to="/admin/settings" className={navLinkClass} onClick={onNavigate}>
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}

export default function AdminLayout() {
  const { operator, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await adminApi.getSummary();
        if (!cancelled) setSummary(result);
      } catch {
        // Badges are a convenience, not a source of truth — a failed poll
        // just leaves the last-known counts (or none) rather than erroring
        // the whole layout.
      }
    }
    load();
    const timer = setInterval(load, SUMMARY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      {/* SIDEBAR — desktop */}
      <aside className="hidden w-[220px] flex-none flex-col border-r border-rule px-3.5 py-5 md:flex">
        <Link to="/admin/queue" className="mb-6 px-1.5 text-[15px] font-semibold">
          Crypto<b className="font-semibold text-vault">XAF</b> admin
        </Link>
        <NavLinks summary={summary} />
        <div className="mt-auto flex flex-col gap-2.5 pt-5">
          <div className="flex items-center justify-between gap-2 px-1.5">
            <span className="truncate text-xs text-muted">{operator?.email}</span>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-rule bg-card px-3 py-2 text-xs font-medium text-ink-2 hover:border-ink-2"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* MAIN COLUMN — mobile top bar (hidden on desktop, sidebar covers it) + the one Outlet */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3.5 md:hidden">
          <Link to="/admin/queue" className="text-[15px] font-semibold">
            Crypto<b className="font-semibold text-vault">XAF</b> admin
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-rule text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
            <div className="relative flex w-[260px] flex-col border-r border-rule bg-paper px-3.5 py-5">
              <div className="mb-6 flex items-center justify-between px-1.5">
                <span className="text-[15px] font-semibold">
                  Crypto<b className="font-semibold text-vault">XAF</b> admin
                </span>
                <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="text-ink-2">
                  ✕
                </button>
              </div>
              <NavLinks summary={summary} onNavigate={() => setMenuOpen(false)} />
              <div className="mt-auto flex flex-col gap-2.5 pt-5">
                <span className="truncate px-1.5 text-xs text-muted">{operator?.email}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-rule bg-card px-3 py-2 text-xs font-medium text-ink-2"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
