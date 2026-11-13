import { ArrowRight, QrCode, Store } from 'lucide-react';
import Button from '../ui/Button.jsx';

export default function CtaSection() {
  return (
    <section className="border-t border-line bg-ink-900 py-16 sm:py-20">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-white sm:text-[36px]">
              Ready to remove the printing queue?
            </h2>
            <p className="mt-3.5 max-w-lg text-[14.5px] leading-relaxed text-white/60">
              Start free with a single machine, or explore the full console with the demo shop
              account. No card required.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Button
                size="lg"
                to="/login?intent=signup"
                variant="primary"
                className="bg-white text-ink-900 hover:bg-white/90"
                iconRight={ArrowRight}
              >
                Create your shop
              </Button>
              <Button
                size="lg"
                to="/login"
                variant="ghost"
                className="border border-white/15 text-white hover:bg-white/10 hover:text-white"
                icon={Store}
              >
                Sign in to demo
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <QrCode className="size-5 text-brand-300" strokeWidth={1.8} />
              <p className="mt-3 text-[13px] font-semibold text-white">Try the print flow</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/50">
                Open a real machine-locked portal and see the quote engine in action.
              </p>
              <a
                href="/print/SP-001"
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand-300 hover:text-white"
              >
                /print/SP-001 <ArrowRight className="size-3" />
              </a>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <Store className="size-5 text-brand-300" strokeWidth={1.8} />
              <p className="mt-3 text-[13px] font-semibold text-white">Owner dashboard</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/50">
                Orders, machines, pricing and settlements — pre-loaded with sample data.
              </p>
              <a
                href="/shop"
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand-300 hover:text-white"
              >
                Demo console <ArrowRight className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
