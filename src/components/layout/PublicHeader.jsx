import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import Button from '../ui/Button.jsx';
import Logo from '../ui/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'For shops', href: '#for-shops' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export default function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dashboardPath = role === 'admin' ? '/admin' : '/shop';

  const scrollTo = (event, href) => {
    event.preventDefault();
    setOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-premium',
        scrolled ? 'border-b border-line bg-white/85 backdrop-blur-lg' : 'bg-transparent',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo size={28} />

        <nav className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => scrollTo(e, link.href)}
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-600 transition-colors duration-200 hover:bg-ink-900/[0.035] hover:text-ink-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          {isAuthenticated ? (
            <Button size="md" to={dashboardPath} iconRight={ArrowRight}>
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="md" onClick={() => navigate('/login')}>
                Log in
              </Button>
              <Button size="md" onClick={() => navigate('/login?intent=signup')}>
                Get started
              </Button>
            </>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-ink-700 hover:bg-surface-muted sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line bg-white sm:hidden"
          >
            <div className="container-page space-y-1 py-4">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => scrollTo(e, link.href)}
                  className="block rounded-lg px-3 py-2.5 text-[14px] font-medium text-ink-700 hover:bg-surface-muted"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3">
                {isAuthenticated ? (
                  <Button to={dashboardPath}>Go to dashboard</Button>
                ) : (
                  <>
                    <Button variant="secondary" to="/login">
                      Log in
                    </Button>
                    <Button to="/login?intent=signup">Get started</Button>
                  </>
                )}
              </div>
              <Link
                to="/print/SP-001"
                className="block px-3 pt-2 text-[12.5px] font-medium text-brand-600"
              >
                Try the customer print portal →
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
