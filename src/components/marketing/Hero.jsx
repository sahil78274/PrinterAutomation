import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileText, QrCode, ScanLine, Smartphone } from 'lucide-react';
import Button from '../ui/Button.jsx';
import QrCodeImage from '../machines/QrCode.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-28 sm:pb-24 sm:pt-36">
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-noise" />
        <div className="absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-100/40 blur-[110px]" />
        <div className="absolute left-1/4 top-40 h-[280px] w-[280px] rounded-full bg-brand-50/70 blur-[90px]" />
      </div>

      <div className="container-page">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* Copy */}
          <div className="max-w-xl">
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 py-1 pl-1.5 pr-3 text-[12px] font-medium text-ink-600 shadow-card backdrop-blur">
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-white">
                  Live
                </span>
                1,240+ machines across 8 cities
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="mt-5 text-[38px] font-semibold leading-[1.06] tracking-[-0.035em] text-ink-900 sm:text-[52px] lg:text-[56px]"
            >
              Scan. Upload. Print.
              <br />
              <span className="text-brand-600">No app. No queue.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={2}
              className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-ink-500 sm:text-[16.5px]"
            >
              SmartPrint turns any print shop into a touchless self-service counter. Scan the QR on
              the machine, upload your PDF, pay digitally — the print agent handles the rest while
              you walk away.
            </motion.p>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={3}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button size="xl" to="/print/SP-001" iconRight={ArrowRight}>
                Try the customer portal
              </Button>
              <Button size="xl" variant="secondary" to="/login?intent=signup">
                Register your shop
              </Button>
            </motion.div>

            <motion.ul
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={4}
              className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-500"
            >
              {['No app install', 'Pay per page', 'Files auto-deleted'].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-success" strokeWidth={2.2} />
                  {item}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[440px] lg:mx-0"
          >
            <div className="relative rounded-2xl border border-line bg-white p-5 shadow-pop">
              {/* Machine header */}
              <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-ink-900 text-white">
                    <QrCode className="size-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight text-ink-900">
                      Sharma Digital Press
                    </p>
                    <p className="text-[11px] text-ink-400">Machine SP-001 · Counter A</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" />
                  Ready
                </span>
              </div>

              <div className="flex items-start gap-4 py-4">
                <div className="rounded-xl border border-line p-2">
                  <QrCodeImage value="https://smartprint.in/print/SP-001" size={104} />
                </div>
                <div className="min-w-0 flex-1 space-y-2.5 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                    Your document
                  </p>
                  <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-muted/70 p-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-danger ring-1 ring-line">
                      <FileText className="size-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-ink-900">
                        Semester-4-Notes.pdf
                      </p>
                      <p className="text-[10.5px] text-ink-400">24 pages · A4 · 1.8 MB</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                    <div className="rounded-md border border-line px-2 py-1.5">
                      <p className="text-ink-400">Mode</p>
                      <p className="font-medium text-ink-900">B&amp;W · Double</p>
                    </div>
                    <div className="rounded-md border border-line px-2 py-1.5">
                      <p className="text-ink-400">Copies</p>
                      <p className="font-medium text-ink-900">1</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-surface-muted/80 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-ink-500">Total payable</span>
                  <span className="text-[19px] font-semibold tracking-tight text-ink-900">₹36</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between rounded-md bg-white px-2.5 py-2 ring-1 ring-line">
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-700">
                    <Smartphone className="size-3.5 text-brand-600" />
                    Pay via UPI · TEST MODE
                  </span>
                  <span className="rounded bg-warn/10 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                    SIMULATED
                  </span>
                </div>
              </div>
            </div>

            {/* Floating chips */}
            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -left-5 top-[38%] hidden rounded-xl border border-line bg-white px-3 py-2 shadow-raised sm:block"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-success/10 text-success">
                  <CheckCircle2 className="size-3.5" strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold leading-tight text-ink-900">
                    Job completed
                  </p>
                  <p className="text-[10px] leading-tight text-ink-400">18 pages in 42s</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              className="absolute -right-4 -bottom-5 hidden rounded-xl border border-line bg-white px-3 py-2 shadow-raised sm:block"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-brand-50 text-brand-600">
                  <ScanLine className="size-3.5" strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold leading-tight text-ink-900">
                    433 scans today
                  </p>
                  <p className="text-[10px] leading-tight text-ink-400">across your network</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-16 border-t border-line pt-6 sm:mt-20"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Printing partners already on SmartPrint
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            {[
              'Sharma Digital Press',
              'Campus Copy Centre',
              'Pixel Point Prints',
              'The Drafting Room',
              'Blue Dot Reprographics',
            ].map((name) => (
              <span key={name} className="text-[13px] font-medium text-ink-400">
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
