import { useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  FlaskConical,
  Landmark,
  Loader2,
  Smartphone,
} from 'lucide-react';
import Button from '../ui/Button.jsx';
import { MockNotice } from '../ui/MockNotice.jsx';
import { cn, formatCurrency } from '../../lib/utils.js';

const METHODS = [
  { id: 'upi', label: 'UPI', hint: 'GPay · PhonePe · Paytm', icon: Smartphone },
  { id: 'card', label: 'Card', hint: 'Visa · Mastercard · RuPay', icon: CreditCard },
  { id: 'netbanking', label: 'Net banking', hint: 'All major banks', icon: Landmark },
];

/**
 * TEST-MODE payment surface.
 *
 * This never contacts a payment gateway. The "simulate" action is explicitly
 * labelled, and the resulting order is flagged `simulated` everywhere it appears.
 * A production build replaces this component with a gateway checkout that is
 * verified server-side before the job is released to the print agent.
 */
export default function TestPaymentPanel({ amount, itemCount, onPay, disabled, disabledReason }) {
  const [method, setMethod] = useState('upi');
  const [processing, setProcessing] = useState(false);
  const [fakeUpi, setFakeUpi] = useState('demo@smartprint');

  const handlePay = async () => {
    setProcessing(true);
    try {
      await onPay({ method });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-warn/25 bg-warn/[0.06] px-3 py-2">
        <FlaskConical className="size-3.5 shrink-0 text-warn" />
        <p className="text-[11.5px] font-medium leading-snug text-warn">
          TEST MODE — no real money moves. This preview never reports a real payment as successful.
        </p>
      </div>

      <div className="space-y-1.5">
        {METHODS.map((option) => {
          const active = method === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setMethod(option.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200',
                active
                  ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/10'
                  : 'border-line bg-white hover:border-line-strong',
              )}
              aria-pressed={active}
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-md',
                  active ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-500',
                )}
              >
                <option.icon className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-ink-900">{option.label}</span>
                <span className="block text-[11px] text-ink-500">{option.hint}</span>
              </span>
              <span
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
                  active ? 'border-brand-600 bg-brand-600' : 'border-line-strong',
                )}
              >
                {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {method === 'upi' ? (
        <div>
          <label htmlFor="test-upi" className="mb-1 block text-[11.5px] font-medium text-ink-600">
            UPI ID (any value — not validated)
          </label>
          <input
            id="test-upi"
            value={fakeUpi}
            onChange={(e) => setFakeUpi(e.target.value)}
            className="field-sm w-full font-mono"
            placeholder="yourname@bank"
          />
        </div>
      ) : null}

      <Button
        size="lg"
        className="w-full"
        onClick={handlePay}
        loading={processing}
        disabled={disabled || processing}
        icon={processing ? undefined : CheckCircle2}
      >
        {processing ? 'Simulating payment…' : `Simulate payment · ${formatCurrency(amount)}`}
      </Button>

      {disabled && disabledReason ? (
        <p className="text-center text-[11.5px] text-warn">{disabledReason}</p>
      ) : (
        <p className="text-center text-[11px] text-ink-400">
          {itemCount} document{itemCount === 1 ? '' : 's'} · order released to the print agent after
          this step
        </p>
      )}

      <MockNotice tone="neutral" icon={Loader2}>
        In production this panel is replaced by a gateway checkout (Razorpay / Stripe), and the job
        is only released after the server verifies the webhook signature.
      </MockNotice>
    </div>
  );
}
