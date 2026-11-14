import { Link } from 'react-router-dom';
import Logo from '../ui/Logo.jsx';
import siteConfig from '../../config/siteConfig.js';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Customer portal', to: '/print/SP-001' },
    ],
  },
  {
    title: 'For shops',
    links: [
      { label: 'Owner dashboard', to: '/shop' },
      { label: 'Machine setup', to: '/shop/machines' },
      { label: 'Pricing manager', to: '/shop/pricing' },
      { label: 'Subscription', to: '/shop/subscription' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Login', to: '/login' },
      { label: 'Register', to: '/register' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms and Conditions', to: siteConfig.links.terms },
      { label: 'Privacy Policy', to: siteConfig.links.privacy },
      { label: 'Refund Policy', to: siteConfig.links.refundPolicy },
      { label: 'Cookie Policy', to: siteConfig.links.cookiePolicy },
    ],
  },
];

export default function PublicFooter() {
  const year = siteConfig.copyrightYear;
  const companyName = siteConfig.legal.companyName;

  return (
    <footer className="border-t border-line bg-white">
      <div className="container-page py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo size={28} />
            <p className="mt-3.5 max-w-xs text-[12.5px] leading-relaxed text-ink-500">
              Touchless, self-service document printing. Customers scan a QR code,
              upload a PDF, pay, and collect — while the shop&apos;s Print Agent handles the rest.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-muted px-2 py-1 text-[11px] text-ink-500">
              <span className="size-1.5 rounded-full bg-warn" />
              Preview build — sample data
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                {column.title}
              </p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-[12.5px] text-ink-600 transition-colors hover:text-brand-700"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-[12.5px] text-ink-600 transition-colors hover:text-brand-700"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-[11.5px] text-ink-400 sm:flex-row sm:items-center">
          <p>
            &copy; {year} {companyName ?? 'SmartPrint'}. All rights reserved.
            {!companyName && (
              <span className="ml-1 text-ink-300">(Configure company name before launch)</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/terms" className="hover:text-ink-600 transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-ink-600 transition-colors">Privacy</Link>
            <Link to="/refund-policy" className="hover:text-ink-600 transition-colors">Refund Policy</Link>
            <Link to="/cookie-policy" className="hover:text-ink-600 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
