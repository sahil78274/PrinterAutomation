import { motion } from 'framer-motion';
import { CreditCard, Printer, ScanLine, UploadCloud } from 'lucide-react';

const STEPS = [
  {
    icon: ScanLine,
    title: 'Scan the machine QR',
    description:
      'Every printer carries a unique QR sticker. Scanning opens the portal already bound to that exact machine and shop — no code to type.',
    detail: '/print/SP-001',
  },
  {
    icon: UploadCloud,
    title: 'Upload your PDF',
    description:
      'Drag in one or more PDFs. Page counts and previews are read instantly in the browser, and your file is never attached to the wrong printer.',
    detail: 'Up to 25 MB · multi-document',
  },
  {
    icon: CreditCard,
    title: 'Choose options & pay',
    description:
      'Pick pages, copies, colour or B&W, single or double-sided. The price updates live and you pay by UPI or card.',
    detail: '₹2 / page onwards',
  },
  {
    icon: Printer,
    title: 'Collect & walk away',
    description:
      'The shop\u2019s local print agent receives the job, prints it and marks it complete. You get a live status screen the whole time.',
    detail: 'Avg. 40s to first page',
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-t border-line bg-white py-20 sm:py-24"
    >
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink-900 sm:text-[38px]">
            Four steps from QR to printed page
          </h2>
          <p className="mt-3.5 text-[15px] leading-relaxed text-ink-500">
            No app installs, no emails with attachments, no “send it to my WhatsApp”. The customer
            journey is designed to take under a minute.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="group relative flex flex-col bg-white p-6 transition-colors duration-300 hover:bg-surface-muted/50"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg border border-line bg-white text-ink-900 shadow-card transition-colors duration-300 group-hover:border-brand-200 group-hover:text-brand-600">
                  <step.icon className="size-[18px]" strokeWidth={1.9} />
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-ink-300">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-ink-900">{step.title}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-500">
                {step.description}
              </p>
              <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] text-ink-400">
                {step.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
