import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Logo from '../../components/ui/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { cn } from '../../lib/utils.js';

export default function LoginPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login({ email: email.trim(), password });
      toast({
        title: `Welcome back, ${result.user.name.split(' ')[0]}`,
        description:
          result.user.role === 'admin' ? 'Admin console loaded.' : 'Shop console loaded.',
        type: 'success',
      });
      const redirect = params.get('redirect');
      navigate(redirect || (result.user.role === 'admin' ? '/admin' : '/shop'), { replace: true });
    } catch (err) {
      // Use generic error messages to avoid user enumeration
      if (err.code === 'INVALID_CREDENTIALS') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'ACCOUNT_LOCKED') {
        setError('Your account has been temporarily locked due to too many failed attempts. Please try again later.');
      } else if (err.code === 'ACCOUNT_INACTIVE') {
        setError('This account is not active. Please contact support.');
      } else if (err.status === 0 || err.code === 'NETWORK_ERROR') {
        setError('Unable to connect to the server. Please check your connection and try again.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
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
            className="mx-auto w-full max-w-[380px]"
          >
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink-900">
              Sign in
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
              Welcome back. Enter your credentials to access your dashboard.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    required
                    className={cn(
                      'h-11 w-full rounded-lg border bg-white pl-10 pr-3 text-[13.5px] text-ink-900 placeholder:text-ink-400',
                      'transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
                      error ? 'border-danger' : 'border-line',
                    )}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    required
                    className={cn(
                      'h-11 w-full rounded-lg border bg-white pl-10 pr-10 text-[13.5px] text-ink-900 placeholder:text-ink-400',
                      'transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
                      error ? 'border-danger' : 'border-line',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-danger/25 bg-danger/[0.05] px-3.5 py-2.5 text-[12.5px] text-danger">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <Link
                  to="/forgot-password"
                  className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
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

            <div className="mt-8 border-t border-line pt-6">
              <p className="text-center text-[13px] text-ink-500">
                Don&apos;t have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-brand-600 hover:text-brand-700"
                >
                  Register your shop
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
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

        <div className="relative flex h-full flex-col justify-center p-12">
          <div>
            <h2 className="max-w-sm text-[30px] font-semibold leading-[1.2] tracking-[-0.03em] text-white">
              Touchless, self-service document printing.
            </h2>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/55">
              Customers scan a QR code, upload their PDF, choose print options,
              pay, and collect — all without waiting in line.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {[
              { title: 'QR-based ordering', desc: 'Each machine gets a unique QR code for instant customer access' },
              { title: 'Real-time tracking', desc: 'Monitor print jobs, machine status, and revenue live' },
              { title: 'Secure payments', desc: 'Integrated payment processing with automatic settlement' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-brand-500/20">
                  <div className="size-2 rounded-full bg-brand-400" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white">{item.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
