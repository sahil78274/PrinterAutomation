import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, ExternalLink, LogOut, Menu, Search, X } from 'lucide-react';
import { cn, initials } from '../../lib/utils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Logo from '../ui/Logo.jsx';
import { MockBadge } from '../ui/MockNotice.jsx';
import DemoControlBanner from '../ui/DemoControlBanner.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getNotifications, markNotificationRead } from '../../services/api.js';
import { timeAgo } from '../../lib/utils.js';

export default function DashboardLayout({ navigation, title, accent = 'Shop console' }) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  const { data: notifications, refetch } = useAsync(() => getNotifications(), []);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    setNotifOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    toast({ type: 'info', title: 'Signed out', description: 'Your demo session has ended.' });
    navigate('/login');
  };

  const handleReadAll = async () => {
    await Promise.all((notifications ?? []).map((n) => markNotificationRead(n.id)));
    refetch();
  };

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <Logo size={26} subtitle={accent} />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {navigation.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="rounded-lg bg-surface-muted p-3">
            <div className="flex items-center gap-2">
              <MockBadge label="Preview mode" />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
              Sample data, no live backend. Payments and printing are simulated.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMobileOpen(false)} />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-full w-[270px] flex-col border-r border-line bg-white"
            >
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <Logo size={26} to={null} />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-surface-muted"
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </button>
              </div>
              <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
                {navigation.map((item) => (
                  <SidebarLink key={item.to} item={item} />
                ))}
              </nav>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="lg:pl-[248px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-ink-600 hover:bg-surface-muted lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <div className="hidden min-w-0 flex-1 sm:block">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                placeholder={title ? `Search ${title.toLowerCase()}…` : 'Search…'}
                className="h-9 w-full rounded-lg border border-line bg-surface-muted pl-9 pr-3 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              to="/print/SP-001"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-900 sm:inline-flex"
            >
              <ExternalLink className="size-3.5" />
              Customer portal
            </Link>

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-surface-muted hover:text-ink-900"
                aria-label="Notifications"
              >
                <Bell className="size-[18px]" />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-brand-600 text-[9px] font-semibold text-white ring-2 ring-white">
                    {unread}
                  </span>
                ) : null}
              </button>
              <AnimatePresence>
                {notifOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-full z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-line bg-white shadow-pop"
                  >
                    <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                      <p className="text-[13px] font-semibold text-ink-900">Notifications</p>
                      <button
                        onClick={handleReadAll}
                        className="text-[11.5px] font-medium text-brand-600 hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <ul className="max-h-[320px] divide-y divide-line overflow-y-auto">
                      {(notifications ?? []).map((item) => (
                        <li
                          key={item.id}
                          className="px-4 py-3 transition-colors hover:bg-surface-muted/60"
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                'mt-1.5 size-1.5 shrink-0 rounded-full',
                                item.read ? 'bg-ink-200' : 'bg-brand-500',
                              )}
                            />
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-medium text-ink-900">{item.title}</p>
                              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
                                {item.body}
                              </p>
                              <p className="mt-1 text-[10.5px] text-ink-400">
                                {timeAgo(item.createdAt)}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-line bg-surface-muted/50 px-4 py-2">
                      <p className="text-[10.5px] text-ink-400">
                        Sample notifications from the demo dataset.
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-surface-muted"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="grid size-8 place-items-center rounded-full bg-ink-900 text-[11px] font-semibold text-white">
                  {initials(user?.name ?? 'User')}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-[12.5px] font-medium leading-tight text-ink-900">
                    {user?.name}
                  </span>
                  <span className="block text-[10.5px] leading-tight text-ink-400">
                    {user?.title}
                  </span>
                </span>
                <ChevronDown className="size-3.5 text-ink-400" />
              </button>

              <AnimatePresence>
                {menuOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white shadow-pop"
                    role="menu"
                  >
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-[13px] font-medium text-ink-900">{user?.name}</p>
                      <p className="truncate text-[11.5px] text-ink-500">{user?.email}</p>
                      <p className="mt-1.5 inline-flex rounded bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-500">
                        {user?.title}
                      </p>
                    </div>
                    <Link
                      to={user?.role === 'admin' ? '/admin/settings' : '/shop/settings'}
                      className="block px-4 py-2.5 text-[12.5px] text-ink-700 transition-colors hover:bg-surface-muted"
                      role="menuitem"
                    >
                      {user?.role === 'admin' ? 'Platform settings' : 'Shop profile'}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[12.5px] text-ink-700 transition-colors hover:bg-surface-muted"
                      role="menuitem"
                    >
                      <LogOut className="size-3.5" />
                      Sign out
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <DemoControlBanner />
          <Outlet />
        </main>

        <footer className="border-t border-line px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-2 text-[11.5px] text-ink-400 sm:flex-row">
            <p>
              © 2026 SmartPrint Technologies. Frontend preview — not connected to production
              services.
            </p>
            <p className="flex items-center gap-3">
              <Link to="/" className="hover:text-ink-700">
                Homepage
              </Link>
              <span className="h-3 w-px bg-line" />
              <span>v1.0.0-preview</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SidebarLink({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-ink-600 hover:bg-surface-muted hover:text-ink-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          {Icon ? (
            <Icon
              className={cn(
                'size-4 shrink-0',
                isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600',
              )}
              strokeWidth={1.9}
            />
          ) : null}
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <span className="ml-auto rounded bg-ink-900/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}
