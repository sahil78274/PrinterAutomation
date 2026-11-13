import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { PLAN_CATALOG } from '../../lib/constants.js';
import { formatCurrency } from '../../lib/utils.js';
import Button from '../ui/Button.jsx';

export default function Pricing({ compact = false }) {
  return (
    <section
      id="pricing"
      className="scroll-mt-16 border-t border-line bg-surface-muted/60 py-20 sm:py-24"
    >
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow justify-center">Pricing</p>
          <h2 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink-900 sm:text-[38px]">
            Simple plans for every shop size
          </h2>
          <p className="mt-3.5 text-[15px] leading-relaxed text-ink-500">
            No setup fee, no hardware cost. You keep the per-page revenue; we charge a small
            platform commission and a flat monthly fee at higher tiers.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLAN_CATALOG.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`relative flex flex-col rounded-xl border bg-white p-6 transition-all duration-300 ease-premium ${
                plan.popular
                  ? 'border-ink-900 shadow-pop lg:-mt-3 lg:mb-3'
                  : 'border-line shadow-card hover:border-line-strong hover:shadow-raised'
              }`}
            >
              {plan.popular ? (
                <span className="absolute -top-2.5 left-6 rounded-full bg-brand-600 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white">
                  Most popular
                </span>
              ) : null}

              <div>
                <h3 className="text-[15px] font-semibold text-ink-900">{plan.name}</h3>
                <p className="mt-1 text-[12.5px] leading-snug text-ink-500">{plan.tagline}</p>
              </div>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.03em] text-ink-900">
                  {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                </span>
                {plan.price !== 0 ? (
                  <span className="text-[12.5px] text-ink-400">/ month</span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-400">
                {plan.limits.commission} platform commission per order
              </p>

              <div className="my-5 h-px w-full bg-line" />

              <ul className="flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-600"
                  >
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" strokeWidth={2.5} />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <Button
                  to="/login?intent=signup"
                  variant={plan.popular ? 'primary' : 'secondary'}
                  className="w-full"
                  iconRight={plan.popular ? ArrowRight : undefined}
                >
                  {plan.price === 0 ? 'Start free' : `Choose ${plan.name}`}
                </Button>
              </div>

              {!compact ? (
                <p className="mt-3 text-center text-[11px] text-ink-400">
                  {plan.limits.machines} machine{plan.limits.machines > 1 ? 's' : ''} ·{' '}
                  {plan.limits.monthlyJobs.toLocaleString('en-IN')} jobs / month
                </p>
              ) : null}
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-[12px] text-ink-400">
          Prices exclude 18% GST. Cancel any time — your QR codes keep working until the end of the
          billing period.
        </p>
      </div>
    </section>
  );
}
