import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Printer,
  ShieldCheck,
  Star,
  WifiOff,
  Wrench,
} from 'lucide-react';
import Logo from '../../components/ui/Logo.jsx';
import Button from '../../components/ui/Button.jsx';
import { MockBadge, MockNotice } from '../../components/ui/MockNotice.jsx';
import DocumentUploader from '../../components/customer/DocumentUploader.jsx';
import DocumentCard from '../../components/customer/DocumentCard.jsx';
import OrderSummary from '../../components/customer/OrderSummary.jsx';
import TestPaymentPanel from '../../components/customer/TestPaymentPanel.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { createOrder, getMachine } from '../../services/api.js';
import { calculateQuote, formatColor, formatSides } from '../../lib/pricing.js';
import { FINISHING_OPTIONS, MACHINE_STATUS_META } from '../../lib/constants.js';
import { cn, formatCurrency, formatPageRanges } from '../../lib/utils.js';
import { useToast } from '../../context/ToastContext.jsx';

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'options', label: 'Options' },
  { id: 'pay', label: 'Payment' },
];

export default function PrintPortal() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: machine, loading, error } = useAsync(() => getMachine(machineId), [machineId]);
  const [documents, setDocuments] = useState([]);
  const [step, setStep] = useState('upload');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    document.title = machine ? `Print at ${machine.shop?.name} · SmartPrint` : 'SmartPrint';
    return () => {
      document.title = 'SmartPrint — Touchless QR Printing';
    };
  }, [machine]);

  const pricing = machine?.pricing;
  const supportsColor = machine?.printer?.supportsColor ?? false;
  const supportsDuplex = machine?.printer?.supportsDuplex ?? false;
  const maxPaper = machine?.printer?.maxPaperSize ?? 'A4';

  const quotes = useMemo(() => {
    if (!pricing) return {};
    return Object.fromEntries(
      documents.map((doc) => [
        doc.id,
        calculateQuote({
          pricing,
          pageCount: doc.selectedPages.length,
          copies: doc.copies,
          color: doc.color,
          sides: doc.sides,
          paper: doc.paper,
          finishing: doc.finishing,
          finishingPrice: FINISHING_OPTIONS.find((f) => f.id === doc.finishing)?.price ?? 0,
        }),
      ]),
    );
  }, [documents, pricing]);

  const totals = useMemo(() => {
    const values = Object.values(quotes);
    return {
      subtotal: values.reduce((sum, q) => sum + q.subtotal, 0),
      minimumTopUp: values.reduce((sum, q) => sum + q.minimumTopUp, 0),
      total: values.reduce((sum, q) => sum + q.total, 0),
      pages: values.reduce((sum, q) => sum + q.printedSidesPerCopy * q.copies, 0),
      sheets: values.reduce((sum, q) => sum + q.sheetsUsed, 0),
    };
  }, [quotes]);

  const updateDocument = useCallback((id, patch) => {
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)));
  }, []);

  const removeDocument = useCallback((id) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const addDocument = useCallback(
    (doc) => {
      if (doc.preview === null) {
        toast({
          type: 'info',
          title: 'Preview unavailable',
          description: 'Page count detected, but this PDF could not be rendered as a thumbnail.',
        });
      }
      setDocuments((prev) => [...prev, doc]);
    },
    [toast],
  );

  const canPay = documents.length > 0 && documents.every((d) => d.selectedPages.length > 0);

  const handlePay = async ({ method }) => {
    setPaying(true);
    try {
      const order = await createOrder({
        machineId: machine.id,
        customerName: 'Walk-in customer',
        customerPhone: null,
        customerEmail: null,
        documents: documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          pages: doc.pageCount,
          selectedPages: doc.selectedPages,
          copies: doc.copies,
          color: doc.color,
          sides: doc.sides,
          paper: doc.paper,
          finishing: doc.finishing,
          sizeKb: doc.sizeKb,
          amount: quotes[doc.id]?.total ?? 0,
        })),
        pageCount: documents.reduce((sum, d) => sum + d.selectedPages.length, 0),
        copies: documents.reduce((sum, d) => sum + d.copies, 0),
        color: documents.some((d) => d.color),
        sides: documents.every((d) => d.sides === 'double') ? 'double' : 'single',
        paper: documents[0]?.paper ?? 'a4',
        finishing: documents[0]?.finishing ?? 'none',
        amount: Math.round(totals.total * 100) / 100,
        platformFee: Math.round(totals.total * 0.035 * 100) / 100,
        paymentMethod: method,
      });
      toast({
        type: 'success',
        title: 'Test payment simulated',
        description: `Order ${order.id} queued at ${machine.name}.`,
      });
      navigate(`/order/${order.id}`, { replace: false });
    } catch (err) {
      toast({ type: 'error', title: 'Could not create order', description: err.message });
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <PortalSkeleton machineId={machineId} />;
  if (error) return <MachineNotFound machineId={machineId} message={error.message} />;

  const statusMeta = MACHINE_STATUS_META[machine.status] ?? MACHINE_STATUS_META.offline;
  const blockedReason =
    machine.status === 'offline'
      ? 'This machine is currently offline. Please ask shop staff for help.'
      : machine.status === 'maintenance'
        ? 'This machine is under maintenance and cannot accept new jobs.'
        : !machine.shop?.acceptOrders
          ? 'This shop has paused new orders. Please ask shop staff for help.'
          : null;

  return (
    <div className="min-h-screen bg-surface-muted/70">
      {/* Slim top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center justify-between gap-3 px-4 sm:px-6">
          <Logo size={24} to="/" />
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border border-line bg-surface-muted px-2 py-1 font-mono text-[11px] font-medium text-ink-600 sm:inline-flex">
              {machine.id}
            </span>
            <MockBadge label="Test mode" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1080px] px-4 pb-16 pt-5 sm:px-6">
        {/* Machine / shop header card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="card overflow-hidden"
        >
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
                <Printer className="size-5" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[17px] font-semibold leading-tight tracking-[-0.02em] text-ink-900">
                    {machine.shop?.name}
                  </h1>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium',
                      machine.status === 'online' && 'bg-success/10 text-success',
                      machine.status === 'busy' && 'bg-brand-50 text-brand-600',
                      machine.status === 'offline' && 'bg-ink-900/[0.05] text-ink-500',
                      machine.status === 'maintenance' && 'bg-warn/10 text-warn',
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', statusMeta.dot)} />
                    {machine.status === 'busy' ? 'Printing now' : statusMeta.label}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-500">
                  {machine.name} · {machine.model}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-400">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {machine.shop?.address}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {machine.shop?.openHours}
                  </span>
                  {machine.shop?.rating ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3 fill-warn text-warn" />
                      {machine.shop.rating} ({machine.shop.reviews})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-line pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <div className="text-center">
                <p className="text-[15px] font-semibold tabular-nums text-ink-900">
                  ₹{pricing.bwSingle}
                </p>
                <p className="text-[10.5px] text-ink-400">B&W / page</p>
              </div>
              <span className="h-8 w-px bg-line" />
              <div className="text-center">
                <p className="text-[15px] font-semibold tabular-nums text-ink-900">
                  {supportsColor ? `₹${pricing.colorSingle}` : '—'}
                </p>
                <p className="text-[10.5px] text-ink-400">Colour / page</p>
              </div>
            </div>
          </div>

          {blockedReason ? (
            <div className="flex items-start gap-2.5 border-t border-warn/20 bg-warn/[0.06] px-4 py-3 sm:px-5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
              <p className="text-[12.5px] font-medium leading-snug text-warn">{blockedReason}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-t border-line bg-surface-muted/60 px-4 py-2.5 sm:px-5">
              <ShieldCheck className="size-3.5 text-success" />
              <p className="text-[11.5px] text-ink-500">
                Your document stays private to this machine and is deleted after printing.
              </p>
            </div>
          )}
        </motion.div>

        {/* Stepper */}
        <div className="mt-5 flex items-center gap-1.5">
          {STEPS.map((item, index) => {
            const currentIndex = STEPS.findIndex((s) => s.id === step);
            const done = index < currentIndex;
            const active = item.id === step;
            return (
              <div key={item.id} className="flex flex-1 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (item.id === 'upload') setStep('upload');
                    if (item.id === 'options' && documents.length) setStep('options');
                    if (item.id === 'pay' && canPay) setStep('pay');
                  }}
                  disabled={item.id !== 'upload' && !documents.length}
                  className={cn(
                    'flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'border-brand-500 bg-white shadow-card'
                      : done
                        ? 'border-line bg-white/60 hover:border-brand-300'
                        : 'border-line bg-white/40',
                    item.id !== 'upload' && !documents.length && 'cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold',
                      active
                        ? 'bg-brand-600 text-white'
                        : done
                          ? 'bg-success/15 text-success'
                          : 'bg-surface-sunken text-ink-400',
                    )}
                  >
                    {done ? <BadgeCheck className="size-3" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      'text-[12px] font-medium',
                      active ? 'text-ink-900' : done ? 'text-ink-700' : 'text-ink-400',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
                {index < STEPS.length - 1 ? <span className="h-px w-3 bg-line-strong" /> : null}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_370px]">
          <div className="min-w-0 space-y-4">
            {step === 'upload' ? (
              <>
                <DocumentUploader
                  onAdd={addDocument}
                  disabled={Boolean(blockedReason) || documents.length >= 5}
                  currentCount={documents.length}
                />
                <AnimatePresence initial={false}>
                  {documents.map((doc, index) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      index={index}
                      supportsColor={supportsColor}
                      supportsDuplex={supportsDuplex}
                      maxPaper={maxPaper}
                      onUpdate={(patch) => updateDocument(doc.id, patch)}
                      onRemove={removeDocument}
                      quote={{
                        ...quotes[doc.id],
                        formatSides: formatSides(doc.sides),
                        formatColor: formatColor(doc.color),
                      }}
                    />
                  ))}
                </AnimatePresence>

                {documents.length === 0 ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        icon: FileText,
                        title: 'PDF only',
                        body: 'Export from Word, Docs or Canva as PDF.',
                      },
                      {
                        icon: ShieldCheck,
                        title: 'Private',
                        body: 'Files never leave this device in preview.',
                      },
                      {
                        icon: BadgeCheck,
                        title: 'Live pricing',
                        body: 'Price updates as you change options.',
                      },
                    ].map((tip) => (
                      <div key={tip.title} className="rounded-lg border border-line bg-white p-3.5">
                        <tip.icon className="size-4 text-ink-400" strokeWidth={1.9} />
                        <p className="mt-2 text-[12px] font-medium text-ink-900">{tip.title}</p>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">{tip.body}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {documents.length > 0 ? (
                  <div className="flex justify-end">
                    <Button
                      size="lg"
                      onClick={() => setStep('options')}
                      disabled={Boolean(blockedReason)}
                      iconRight={ArrowRight}
                    >
                      Review {documents.length} document{documents.length > 1 ? 's' : ''}
                    </Button>
                  </div>
                ) : null}

                <MockNotice tone="neutral" title="How printing works here">
                  Nothing is sent to a printer from this browser. A local Print Agent running at the
                  shop collects the paid job and prints it on {machine.model}. This preview only
                  simulates that hand-off.
                </MockNotice>
              </>
            ) : null}

            {step === 'options' ? (
              <>
                <div className="card p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[14px] font-semibold text-ink-900">
                        Review your print options
                      </h2>
                      <p className="mt-0.5 text-[12px] text-ink-500">
                        {documents.length} document{documents.length > 1 ? 's' : ''} ·{' '}
                        {totals.pages} printed sides · {totals.sheets} sheets
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep('upload')}
                      icon={ArrowLeft}
                    >
                      Add more
                    </Button>
                  </div>

                  <div className="mt-4 divide-y divide-line">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-ink-900">
                            {doc.name}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-ink-500">
                            Pages {formatPageRanges(doc.selectedPages) || '—'} ·{' '}
                            {formatColor(doc.color)} · {formatSides(doc.sides)} · {doc.copies} cop
                            {doc.copies > 1 ? 'ies' : 'y'}
                          </p>
                        </div>
                        <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-ink-800">
                          {formatCurrency(quotes[doc.id]?.total ?? 0, { decimals: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button variant="secondary" onClick={() => setStep('upload')} icon={ArrowLeft}>
                    Back
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => setStep('pay')}
                    disabled={!canPay || Boolean(blockedReason)}
                    iconRight={ArrowRight}
                  >
                    Continue to payment
                  </Button>
                </div>
                {!canPay ? (
                  <p className="text-right text-[11.5px] text-warn">
                    Each document needs at least one page selected.
                  </p>
                ) : null}
              </>
            ) : null}

            {step === 'pay' ? (
              <>
                <div className="card p-4 sm:p-5">
                  <h2 className="text-[14px] font-semibold text-ink-900">Payment</h2>
                  <p className="mt-0.5 text-[12px] text-ink-500">
                    Total {formatCurrency(totals.total)} for {documents.length} document
                    {documents.length > 1 ? 's' : ''} at {machine.name}.
                  </p>
                  <div className="mt-4">
                    <TestPaymentPanel
                      amount={totals.total}
                      itemCount={documents.length}
                      onPay={handlePay}
                      disabled={Boolean(blockedReason) || paying}
                      disabledReason={blockedReason ?? undefined}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button variant="secondary" onClick={() => setStep('options')} icon={ArrowLeft}>
                    Back to options
                  </Button>
                </div>
              </>
            ) : null}
          </div>

          {/* Sidebar summary */}
          <aside className="min-w-0">
            <div className="lg:sticky lg:top-[72px]">
              <OrderSummary
                items={documents.map((doc) => ({
                  id: doc.id,
                  name: doc.name,
                  detail: `${doc.selectedPages.length} pages · ${formatColor(doc.color)} · ${formatSides(doc.sides)} · ${doc.copies}×`,
                  amount: quotes[doc.id]?.total ?? 0,
                }))}
                totals={totals}
                machineName={machine.name}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-ink-500">Printed sides</span>
                    <span className="font-medium tabular-nums text-ink-800">{totals.pages}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-ink-500">Sheets used</span>
                    <span className="font-medium tabular-nums text-ink-800">{totals.sheets}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-ink-500">Est. print time</span>
                    <span className="font-medium tabular-nums text-ink-800">
                      {Math.max(1, Math.ceil(totals.sheets / 18))} min
                    </span>
                  </div>
                </div>
              </OrderSummary>

              <div className="mt-3 rounded-lg border border-line bg-white p-3.5">
                <div className="flex items-start gap-2">
                  <WifiOff className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
                  <p className="text-[11px] leading-relaxed text-ink-500">
                    Printed by{' '}
                    <span className="font-medium text-ink-700">{machine.agent.name}</span>, the
                    shop&apos;s local print agent
                    {machine.agent.status === 'connected'
                      ? ' (connected)'
                      : ' (currently disconnected)'}
                    .
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-ink-400">
                <Link to="/" className="hover:text-ink-700">
                  Homepage
                </Link>
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" /> {machine.shop?.phone}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PortalSkeleton({ machineId }) {
  return (
    <div className="min-h-screen bg-surface-muted/70">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center px-4 sm:px-6">
          <Skeleton className="h-6 w-28" />
        </div>
      </header>
      <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="card p-5">
            <Skeleton className="h-24 w-full rounded-lg" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="card p-5">
            <Skeleton className="h-3 w-24" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-400">
          <Loader2 className="size-3.5 animate-spin" />
          Connecting to machine {machineId}…
        </div>
      </div>
    </div>
  );
}

function MachineNotFound({ machineId, message }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-muted/70 px-4">
      <div className="card w-full max-w-md p-7 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-danger/10 text-danger">
          <Wrench className="size-5" strokeWidth={2} />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight text-ink-900">
          Machine not recognised
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{message}</p>
        <div className="mt-4 rounded-lg border border-line bg-surface-muted px-3 py-2 text-left">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            Scanned machine ID
          </p>
          <p className="mt-0.5 font-mono text-[12.5px] text-ink-700">{machineId}</p>
        </div>
        <div className="mt-5 space-y-2">
          <Button className="w-full" to="/print/SP-001">
            Open demo machine SP-001
          </Button>
          <Button className="w-full" variant="secondary" to="/">
            Back to SmartPrint
          </Button>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
          If you scanned a sticker at a shop, ask the staff to check that the machine is registered
          on SmartPrint.
        </p>
      </div>
    </div>
  );
}
