import PublicHeader from '../../components/layout/PublicHeader.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import siteConfig from '../../config/siteConfig.js';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="container-page py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[32px] font-semibold tracking-tight text-ink-900">Contact</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
            Get in touch with the SmartPrint team.
          </p>

          <div className="mt-10 space-y-8">
            <section>
              <h2 className="mb-3 text-[16px] font-semibold text-ink-900">Support</h2>
              {siteConfig.contact.supportEmail ? (
                <p className="text-[14px] text-ink-700">
                  Email:{' '}
                  <a href={`mailto:${siteConfig.contact.supportEmail}`} className="text-brand-600 hover:text-brand-700">
                    {siteConfig.contact.supportEmail}
                  </a>
                </p>
              ) : (
                <p className="text-[14px] text-ink-500">
                  Support contact details will be available once configured by the platform operator.
                </p>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-[16px] font-semibold text-ink-900">For Shop Owners</h2>
              <p className="text-[14px] leading-relaxed text-ink-700">
                If you are a shop owner needing help with your dashboard, machines, or subscription,
                log in to your shop console and use the in-app support options.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-[16px] font-semibold text-ink-900">For Customers</h2>
              <p className="text-[14px] leading-relaxed text-ink-700">
                Having trouble with a print order? Use the order tracking page to check your order
                status, or contact the shop directly where you placed the order.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-[16px] font-semibold text-ink-900">Grievance Redressal</h2>
              <p className="text-[14px] leading-relaxed text-ink-700">
                For unresolved complaints, use the Platform&apos;s support system to raise a ticket.
                Grievance officer contact details will be provided once configured.
              </p>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
