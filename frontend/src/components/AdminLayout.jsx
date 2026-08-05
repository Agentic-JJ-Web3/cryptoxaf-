import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../admin/AdminAuthContext';

const navLinkClass = ({ isActive }) =>
  `text-sm font-medium ${isActive ? 'text-ink' : 'text-muted hover:text-ink-2'}`;

export default function AdminLayout() {
  const { operator, logout } = useAdminAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex w-full max-w-[720px] flex-col px-5">
        <div className="flex items-center justify-between gap-4 border-b border-rule py-5">
          <div className="flex items-center gap-6">
            <Link to="/admin/queue" className="text-[15px] font-semibold">
              Crypto<b className="font-semibold text-vault">XAF</b> admin
            </Link>
            <nav className="flex items-center gap-5">
              <NavLink to="/admin/queue" className={navLinkClass}>
                Queue
              </NavLink>
              <NavLink to="/admin/notify-requests" className={navLinkClass}>
                Notify list
              </NavLink>
              <NavLink to="/admin/reviews" className={navLinkClass}>
                Reviews
              </NavLink>
              <NavLink to="/admin/settings" className={navLinkClass}>
                Settings
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{operator?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-rule bg-card px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-ink-2"
            >
              Log out
            </button>
          </div>
        </div>
        <div className="py-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
