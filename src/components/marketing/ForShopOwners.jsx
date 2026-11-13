import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Check,
  MonitorSmartphone,
  ReceiptIndianRupee,
  Store,
} from 'lucide-react';
import Button from '../ui/Button.jsx';

const OUTCOMES = [
  {
    icon: BarChart3,
    label: 'Revenue visibility',
    value: 'Daily job, page and revenue reporting per machine — exportable for your accountant.',
  },
  {
    icon: MonitorSmartphone,
    label: 'Less counter time',
    value: 'Customers self-serve the upload and payment. Staff only load paper.',
  },
  {
    icon: ReceiptIndianRupee,
    label: 'Clean settlements',
    value: 'Digital payments settle on a fixed cycle with a per-order fee breakdown.',
  },
];

const CHECKLIST = [
  'Unlimited QR reprints for your machines',
  'Set your own per-page rates any time',
  'Mark a machine offline in one tap',
  'Track every job: queued → printing → done',
  'Staff-friendly, works on any tablet',
  'No hardware purchase — bring your existing printer',
];

export default function ForShopOwners() {
  return (
    <section id="for-shops" className="scroll-mt-16 border-t border-line bg-white py-20 sm:py-24">
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow">For shop owners</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink-900 sm:text-[38px]">
              Turn your counter into a self-service kiosk
            </h2>
            <p className="mt-3.5 text-[15px] leading-relaxed text-ink-500">
              Register your shop, add each printer, and stick the QR on the machine. SmartPrint runs
              a small local print agent that talks to your printer — nothing to integrate, and no
              browser ever touches your hardware.
            </p>

            <div className="mt-8 space-y-4">
              {OUTCOMES.map((outcome) => (
                <div key={outcome.label} className="flex gap-3.5">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-muted text-ink-700">
                    <outcome.icon className="size-4" strokeWidth={1.9} />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink-900">{outcome.label}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">
                      {outcome.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <Button to="/login?intent=signup" iconRight={ArrowRight}>
                Register your shop
              </Button>
              <Button variant="secondary" to="/shop">
                View demo dashboard
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="rounded-2xl border border-line bg-surface-muted/70 p-1.5 shadow-card">
              <div className="rounded-xl border border-line bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-ink-900 text-white">
                      <Store className="size-[18px]" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-ink-900">Sharma Digital Press</p>
                      <p className="text-[11.5px] text-ink-400">
                        Growth plan · 3 machines · Gurugram
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                    Live
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 py-5">
                  {[
                    { label: 'Today', value: '42', sub: 'orders' },
                    { label: 'Revenue', value: '₹3,860', sub: 'today' },
                    { label: 'Pages', value: '1,284', sub: 'printed' },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className="text-[11px] text-ink-400">{stat.label}</p>
                      <p className="mt-0.5 text-[19px] font-semibold tracking-tight text-ink-900">
                        {stat.value}
                      </p>
                      <p className="text-[10.5px] text-ink-400">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t border-line pt-4">
                  {[
                    {
                      name: 'SP-001 · Counter A',
                      state: 'Printing',
                      tone: 'text-brand-600 bg-brand-50',
                    },
                    {
                      name: 'SP-002 · Counter B',
                      state: 'Online',
                      tone: 'text-success bg-success/10',
                    },
                    {
                      name: 'SP-003 · Back Office',
                      state: 'Maintenance',
                      tone: 'text-warn bg-warn/10',
                    },
                  ].map((machine) => (
                    <div
                      key={machine.name}
                      className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
                    >
                      <span className="text-[12px] font-medium text-ink-800">{machine.name}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${machine.tone}`}
                      >
                        {machine.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {CHECKLIST.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12px] leading-snug text-ink-600"
                >
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
