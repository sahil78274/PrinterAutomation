import PublicHeader from '../../components/layout/PublicHeader.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="container-page py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-[32px] font-semibold tracking-tight text-ink-900">About SmartPrint</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
            SmartPrint is a QR-based self-service document printing platform that turns any
            print shop counter into a touchless ordering point.
          </p>

          <div className="mt-10 space-y-8 text-[14px] leading-relaxed text-ink-700">
            <section>
              <h2 className="mb-2 text-[18px] font-semibold text-ink-900">The Problem</h2>
              <p>
                Print shops are still largely manual: customers wait in line, hand over USB drives
                or email files, negotiate pricing at the counter, and hope their printout comes out
                right. This is slow for customers, labor-intensive for shops, and error-prone for
                everyone.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-[18px] font-semibold text-ink-900">Our Solution</h2>
              <p>
                SmartPrint places a unique QR code at each printing machine. Customers scan it,
                upload their PDF, choose print options (color/B&amp;W, single/double-sided, copies),
                see the price instantly, pay, and collect their printout — all without talking
                to anyone.
              </p>
              <p className="mt-3">
                A local Print Agent running on the shop&apos;s computer receives the job and sends it
                directly to the printer. No files pass through email, no USB drives, no manual
                data entry.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-[18px] font-semibold text-ink-900">For Shop Owners</h2>
              <p>
                Shop owners get a dashboard to manage machines, set pricing, view orders, monitor
                their print queue, and track revenue — all in real time. Subscription plans scale
                from single-machine shops to multi-branch networks.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-[18px] font-semibold text-ink-900">How It Works</h2>
              <ol className="list-inside list-decimal space-y-2">
                <li>Shop owner registers and sets up machines with QR codes</li>
                <li>QR codes are placed at each printing machine</li>
                <li>Customer scans a QR code with their phone</li>
                <li>Customer uploads a PDF, selects options, and pays</li>
                <li>Print Agent on the shop computer receives and prints the job</li>
                <li>Customer collects their printout</li>
              </ol>
            </section>

            <section className="rounded-lg border border-line bg-surface-muted p-6">
              <p className="text-[14px] text-ink-600">
                Interested in bringing SmartPrint to your print shop?{' '}
                <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
                  Get started →
                </Link>
              </p>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
