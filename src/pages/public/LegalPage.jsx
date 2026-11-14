import PublicHeader from '../../components/layout/PublicHeader.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';

/**
 * Reusable legal page wrapper. Renders a professional layout with a consistent
 * header/footer and a clean content column. No fake company details — the
 * content is passed in as children.
 */
export default function LegalPage({ title, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="container-page py-12">
        <article className="mx-auto max-w-3xl">
          <header className="mb-8 border-b border-line pb-6">
            <h1 className="text-[28px] font-semibold tracking-tight text-ink-900">{title}</h1>
            {lastUpdated && (
              <p className="mt-2 text-[13px] text-ink-500">Last updated: {lastUpdated}</p>
            )}
          </header>
          <div className="prose-legal space-y-6 text-[14px] leading-relaxed text-ink-700">
            {children}
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
