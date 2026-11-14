import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Logo from '../../components/ui/Logo.jsx';
import Button from '../../components/ui/Button.jsx';
import { confirmPasswordReset } from '../../services/api.js';
import { cn } from '../../lib/utils.js';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <div className="border-b border-line px-5 py-4 sm:px-10">
          <Link to="/" className="inline-block"><Logo size={24} /></Link>
        </div>
        <main className="flex flex-1 items-center justify-center px-5 py-12">
          <div className="w-full max-w-md text-center">
            <h1 className="text-[20px] font-semibold text-ink-900">Invalid reset link</h1>
            <p className="mt-2 text-[14px] text-ink-600">
              This password reset link is missing a token. Please request a new one.
            </p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-block text-[13px] font-medium text-brand-600 hover:text-brand-700"
            >
              Request a new reset link
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[a-zA-Z]/.test(password)) {
      setError('Password must contain a letter.');
      return;
    }
    if (!/\d/.test(password)) {
      setError('Password must contain a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset({ token, password });
      setSuccess(true);
    } catch (err) {
      if (err.code === 'INVALID_RESET_TOKEN' || err.code === 'RESET_TOKEN_EXPIRED') {
        setError('This reset link is invalid or has expired. Please request a new one.');
      } else if (err.code === 'WEAK_PASSWORD') {
        setError('Password does not meet the requirements.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b border-line px-5 py-4 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo size={24} />
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {success ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h2 className="mt-4 text-[20px] font-semibold text-ink-900">Password reset complete</h2>
              <p className="mt-2 text-[14px] text-ink-600">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <Button
                className="mt-6 w-full"
                onClick={() => navigate('/login')}
              >
                Go to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-[24px] font-semibold tracking-tight text-ink-900">
                Choose a new password
              </h1>
              <p className="mt-2 text-[14px] text-ink-500">
                Enter your new password below. Make sure it is strong and unique.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      required
                      placeholder="At least 8 characters"
                      className="h-11 w-full rounded-lg border border-line bg-white px-3 pr-10 text-[13.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
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

                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    required
                    placeholder="Re-enter your password"
                    className={cn(
                      'h-11 w-full rounded-lg border bg-white px-3 text-[13.5px] text-ink-900 placeholder:text-ink-400',
                      'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
                      'border-line',
                    )}
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-danger/25 bg-danger/[0.05] px-3.5 py-2.5 text-[12.5px] text-danger">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Reset password
                </Button>
              </form>

              <p className="mt-1.5 text-[11.5px] text-ink-400">
                Must be at least 8 characters with a letter and a number.
              </p>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
