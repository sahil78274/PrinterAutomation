import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck, Store } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Logo from '../../components/ui/Logo.jsx';
import Input from '../../components/ui/Input.jsx';
import { MockNotice } from '../../components/ui/MockNotice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { DEMO_ACCOUNTS, PLAN_CATALOG } from '../../lib/constants.js';
import { cn, formatCurrency } from '../../lib/utils.js';

const ROLE_TABS = [
  { id: 'shop', label: 'Shop owner', icon: Store },
  { id: 'admin', label: 'Super admin', icon: ShieldCheck },
];

export default function LoginPage() {
  const [params] = useSearchParams();
  const intent = params.get('intent');
  const [mode, setMode] = useState(intent === 'signup' ? 'signup' : 'login');
  const [role, setRole] = useState('shop');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, role: currentRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(currentRole === 'admin' ? '/admin' : '/shop', { replace: true });
    }
  }, [isAuthenticated, currentRole, navigate]);

  useEffect(() => {
    const account = DEMO_ACCOUNTS.find((a) => a.role === role);
    if (account && !email) setEmail(account.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login({ email, password });
      toast({
        title: `Welcome back, ${result.user.name.split(' ')[0]}`,
        description:
          result.user.role === 'admin' ? 'Super admin console loaded.' : 'Shop console loaded.',
        type: 'success',
      });
      const redirect = params.get('redirect');
      navigate(redirect || (result.user.role === 'admin' ? '/admin' : '/shop'), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (account) => {
    setMode('login');
    setRole(account.role);
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Left: form */}
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between">
          <Logo size={28} />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            <ArrowLeft className="size-3.5" />
            Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[400px]"
          >
            {mode === 'login' ? (
              <>
                <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink-900">
                  Sign in to SmartPrint
                </h1>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
                  Access your shop console or the platform admin dashboard.
                </p>

                <div className="mt-6 inline-flex w-full rounded-lg bg-surface-sunken p-0.5">
                  {ROLE_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setRole(tab.id);
                        setEmail(DEMO_ACCOUNTS.find((a) => a.role === tab.id)?.email ?? '');
                        setPassword('');
                        setError('');
                      }}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12.5px] font-medium transition-all duration-200',
                        role === tab.id
                          ? 'bg-white text-ink-900 shadow-card ring-1 ring-black/[0.03]'
                          : 'text-ink-500 hover:text-ink-800',
                      )}
                    >
                      <tab.icon className="size-3.5" strokeWidth={2} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <Input
                    label="Email address"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@shop.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Input
                    label="Password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  {error ? (
                    <p className="rounded-lg border border-danger/25 bg-danger/[0.05] px-3 py-2 text-[12.5px] text-danger">
                      {error}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[12.5px] text-ink-500">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="size-3.5 rounded border-line-strong accent-brand-600"
                      />
                      Keep me signed in
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[12.5px] font-medium text-brand-600 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    loading={loading}
                    iconRight={ArrowRight}
                  >
                    Sign in
                  </Button>
                </form>

                <div className="mt-5 rounded-xl border border-line bg-surface-muted/60 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                    Demo credentials
                  </p>
                  <div className="mt-2.5 space-y-1.5">
                    {DEMO_ACCOUNTS.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => fillDemoAccount(account)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-white px-2.5 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-medium text-ink-900">
                            {account.shopName}
                          </span>
                          <span className="block truncate font-mono text-[10.5px] text-ink-400">
                            {account.email} · {account.password}
                          </span>
                        </span>
                        <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                          {account.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="mt-5 text-center text-[12.5px] text-ink-500">
                  New to SmartPrint?{' '}
                  <button
                    onClick={() => setMode('signup')}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    Register your shop
                  </button>
                </p>
              </>
            ) : (
              <SignupForm onBack={() => setMode('login')} />
            )}
          </motion.div>
        </div>

        <p className="text-center text-[11px] text-ink-400 lg:text-left">
          Frontend preview — authentication is simulated locally, no credentials are transmitted.
        </p>
      </div>

      {/* Right: brand panel */}
      <div className="relative hidden overflow-hidden border-l border-line bg-ink-900 lg:block">
        <div className="absolute inset-0 opacity-[0.35]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '52px 52px',
            }}
          />
        </div>
        <div className="absolute -right-24 top-1/4 h-[360px] w-[360px] rounded-full bg-brand-600/25 blur-[100px]" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium text-white/70">
              <span className="size-1.5 rounded-full bg-success" />
              1,240 machines online
            </span>
            <h2 className="mt-6 max-w-sm text-[30px] font-semibold leading-[1.2] tracking-[-0.03em] text-white">
              One platform for every printer in your network.
            </h2>
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-white/55">
              Machine-specific QR ordering, per-machine pricing, live job monitoring and clean
              settlements — all from a single console.
            </p>
          </div>

          <div className="space-y-3">
            {[
              'Unique machine ID + QR for every printer',
              'Real-time job status from the local print agent',
              'Per-order fee and settlement transparency',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-[12.5px] text-white/70">
                <CheckCircle2
                  className="mt-0.5 size-3.5 shrink-0 text-brand-300"
                  strokeWidth={2.2}
                />
                {item}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-white">
                <Lock className="size-4" strokeWidth={2} />
              </span>
              <p className="text-[12.5px] font-medium text-white">Route protection</p>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-white/50">
              Shop routes and admin routes are separated by role. In production every Express
              endpoint re-verifies the JWT and role — the client guard alone is never trusted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignupForm({ onBack }) {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    email: '',
    phone: '',
    city: '',
    plan: 'growth',
  });

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  if (submitted) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-success/10 text-success">
          <CheckCircle2 className="size-6" strokeWidth={2} />
        </span>
        <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-ink-900">
          Application recorded
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-500">
          This form is a frontend preview — nothing was submitted to a server. In production you
          would receive a verification email and an onboarding call within one working day.
        </p>
        <MockNotice className="mt-5 text-left" title="Simulated submission">
          Account provisioning, KYC and machine registration are handled by the Express API once the
          backend is connected.
        </MockNotice>
        <Button className="mt-5 w-full" onClick={onBack} variant="secondary">
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink-900">
        Register your shop
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
        Two minutes to set up. Add your printers and print the QR codes once your account is
        verified.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          toast({ type: 'info', title: 'Preview only', description: 'No data was sent anywhere.' });
        }}
      >
        <Input
          label="Shop name"
          name="shopName"
          placeholder="e.g. Sharma Digital Press"
          value={form.shopName}
          onChange={update('shopName')}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Owner name"
            name="ownerName"
            placeholder="Full name"
            value={form.ownerName}
            onChange={update('ownerName')}
            required
          />
          <Input
            label="City"
            name="city"
            placeholder="e.g. Gurugram"
            value={form.city}
            onChange={update('city')}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="you@shop.in"
            value={form.email}
            onChange={update('email')}
            required
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={update('phone')}
            required
          />
        </div>

        <div>
          <p className="label">Plan</p>
          <div className="space-y-1.5">
            {PLAN_CATALOG.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, plan: plan.id }))}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors',
                  form.plan === plan.id
                    ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/10'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <span className="text-[12.5px] font-medium text-ink-900">{plan.name}</span>
                <span className="text-[12px] text-ink-500">
                  {plan.price === 0 ? 'Free' : `${formatCurrency(plan.price)}/mo`} ·{' '}
                  {plan.limits.commission} fee
                </span>
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" iconRight={ArrowRight}>
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-ink-500">
        Already registered?{' '}
        <button onClick={onBack} className="font-medium text-brand-600 hover:underline">
          Sign in
        </button>
      </p>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink-400">
        <Mail className="size-3" />
        Preview mode — no email is sent.
      </p>
    </>
  );
}
