import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { InlineLink } from '../ui/Avatar.jsx';

const FAQS = [
  {
    q: 'Do customers need to install an app?',
    a: 'No. Scanning the machine QR opens SmartPrint in the phone browser. The whole flow — upload, options, payment, status — works on the mobile web.',
  },
  {
    q: 'How does the QR code know which printer to use?',
    a: 'Every machine is issued a unique ID at registration (for example SP-001) and the QR encodes a URL containing that ID. The portal resolves the ID to a shop and machine before an order can be created.',
  },
  {
    q: 'Does the browser send files straight to the printer?',
    a: 'Never. Browsers cannot safely talk to printers, so SmartPrint uses a small local Print Agent installed on a shop computer. The agent polls for paid jobs for its own machines and prints them with the configured driver.',
  },
  {
    q: 'What happens to my uploaded documents?',
    a: 'Documents are used only to generate the print job for that machine. In production they are deleted automatically once printing completes, or after a short configurable window if the job is abandoned.',
  },
  {
    q: 'Can I set different rates for each machine?',
    a: 'Yes. Pricing is configured per machine: black & white and colour rates, single and double-sided, A3 surcharge, finishing charges and a minimum order value.',
  },
  {
    q: 'Is payment live in this preview?',
    a: 'No. This is a frontend preview running on sample data. The payment interface is explicitly labelled TEST MODE and never marks a real payment as successful. Production will connect a payment gateway with server-side verification.',
  },
  {
    q: 'What if a printer breaks mid-job?',
    a: 'The agent reports the failure back to the platform, the job is marked failed, and shop staff can refund it from the dashboard with one click. Customers see the failure on their status screen immediately.',
  },
  {
    q: 'How many shops can run on one platform?',
    a: 'The architecture is multi-tenant from the ground up: unlimited shops, unlimited machines, one central dashboard. Super admins can monitor every machine in the network.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="scroll-mt-16 border-t border-line bg-white py-20 sm:py-24">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink-900 sm:text-[38px]">
              Questions, answered
            </h2>
            <p className="mt-3.5 text-[14.5px] leading-relaxed text-ink-500">
              Everything about QR delivery, the print agent and how payments settle. Still unsure?{' '}
              <InlineLink to="/login">Talk to the team</InlineLink>.
            </p>
          </div>

          <div className="divide-y divide-line border-y border-line">
            {FAQS.map((faq, index) => {
              const isOpen = open === index;
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    className="flex w-full items-start justify-between gap-4 py-4 text-left transition-colors hover:text-brand-700"
                    aria-expanded={isOpen}
                  >
                    <span
                      className={cn(
                        'text-[14px] font-medium leading-snug transition-colors',
                        isOpen ? 'text-brand-700' : 'text-ink-900',
                      )}
                    >
                      {faq.q}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-all duration-300',
                        isOpen
                          ? 'rotate-45 border-brand-600 bg-brand-600 text-white'
                          : 'border-line-strong text-ink-500',
                      )}
                    >
                      <Plus className="size-3" strokeWidth={2.5} />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="pb-4 pr-8 text-[13px] leading-relaxed text-ink-500">
                          {faq.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
