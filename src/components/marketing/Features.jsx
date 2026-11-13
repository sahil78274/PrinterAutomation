import { motion } from 'framer-motion';
import {
  FileCheck2,
  Gauge,
  IndianRupee,
  Layers,
  QrCode,
  ShieldCheck,
  WifiOff,
  Zap,
} from 'lucide-react';

const FEATURES = [
  {
    icon: QrCode,
    title: 'Machine-locked ordering',
    description:
      'Each QR encodes a machine ID that resolves server-side. A customer can never accidentally print at the shop next door.',
  },
  {
    icon: IndianRupee,
    title: 'Transparent per-page pricing',
    description:
      'Shops set their own B&W, colour, duplex and finishing rates. Customers see the exact total before paying.',
  },
  {
    icon: FileCheck2,
    title: 'Live page detection',
    description:
      'Page counts, page ranges and first-page previews are read from the actual PDF, so quotes are never wrong.',
  },
  {
    icon: Layers,
    title: 'Page & copy control',
    description:
      'Print a single chapter, three copies of page 12, or the whole document — mixed selections in one order.',
  },
  {
    icon: ShieldCheck,
    title: 'Files deleted after printing',
    description:
      'Documents are purged from the platform once the job completes. No shared desktops, no leftover files.',
  },
  {
    icon: Zap,
    title: 'Instant payout reconciliation',
    description:
      'Every order carries its platform fee, shop earning and settlement reference for clean daily books.',
  },
  {
    icon: Gauge,
    title: 'Live machine health',
    description:
      'Paper, toner and agent heartbeats for every machine, so shops fix problems before a customer walks in.',
  },
  {
    icon: WifiOff,
    title: 'Agent queue resilience',
    description:
      'If the agent briefly drops offline, paid jobs stay queued and resume automatically on reconnect.',
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-16 border-t border-line bg-surface-muted/60 py-20 sm:py-24"
    >
      <div className="container-page">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Platform capabilities</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink-900 sm:text-[38px]">
              Built for real print shops, not demos
            </h2>
            <p className="mt-3.5 text-[15px] leading-relaxed text-ink-500">
              The details that separate a working self-service counter from a QR code stuck on a
              printer.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-6 rounded-xl border border-line bg-white px-5 py-4 shadow-card sm:flex">
            <div>
              <p className="text-[22px] font-semibold tracking-tight text-ink-900">99.4%</p>
              <p className="text-[11.5px] text-ink-400">Job success rate</p>
            </div>
            <span className="h-9 w-px bg-line" />
            <div>
              <p className="text-[22px] font-semibold tracking-tight text-ink-900">38s</p>
              <p className="text-[11.5px] text-ink-400">Median time to print</p>
            </div>
          </div>
        </div>

        <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (index % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="card card-hover group p-5"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
                <feature.icon className="size-4" strokeWidth={2} />
              </span>
              <h3 className="mt-4 text-[14px] font-semibold leading-snug text-ink-900">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
