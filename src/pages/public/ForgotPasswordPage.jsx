import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import Logo from '../../components/ui/Logo.jsx';
import Button from '../../components/ui/Button.jsx';
import { requestPasswordReset, getEmailStatus } from '../../services/api.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if email delivery is configured
    getEmailStatus()
      .then((status) => setEmailConfigured(status.configured))
      .catch(() => setEmailConfigured(null));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset({ email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      if (err.status === 0 || err.code === 'NETWORK_ERROR') {
        setError('Unable to connect to the server. Please check your connection and try again.');
      } else {
        setError('Something went wrong. Please try again.');
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
          {!submitted ? (
            <>
              <h1 className="text-[24px] font-semibold tracking-tight text-ink-900">
                Reset your password
              </h1>
              <p className="mt-2 text-[14px] text-ink-500">
                Enter your registered email address and we will send you a link to reset your password.
              </p>

              {emailConfigured === false && (
                <div className="mt-5 flex items-start gap-3 rounded-lg border border-warn/30 bg-warn/[0.05] px-4 py-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" />
                  <div>
                    <p className="text-[12.5px] font-medium text-ink-800">
                      Email delivery not configured
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
                      Password reset emails are currently disabled. The reset token will be
                      logged to the server console. Contact your system administrator to
                      configure SMTP for email delivery.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    required
                    placeholder="you@example.com"
                    className="h-11 w-full rounded-lg border border-line bg-white px-3 text-[13.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-danger/25 bg-danger/[0.05] px-3.5 py-2.5 text-[12.5px] text-danger">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Send reset link
                </Button>
              </form>

              <p className="mt-6 text-center text-[13px] text-ink-500">
                Remember your password?{' '}
                <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h2 className="mt-4 text-[20px] font-semibold text-ink-900">Check your email</h2>
              <p className="mt-2 text-[14px] text-ink-600">
                If an account exists for <strong className="text-ink-900">{email}</strong>,
                we have sent a password reset link.
              </p>

              {emailConfigured === false && (
                <div className="mt-5 rounded-lg border border-line bg-surface-muted px-4 py-3 text-left">
                  <p className="text-[12px] text-ink-600">
                    Since email delivery is not configured, the reset link has been logged to the
                    server console. Ask your system administrator for the reset token.
                  </p>
                </div>
              )}

              <p className="mt-5 text-[13px] text-ink-500">
                Did not receive the email? Check your spam folder, or{' '}
                <button
                  onClick={() => { setSubmitted(false); setEmail(''); }}
                  className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  try again
                </button>.
              </p>

              <Link
                to="/login"
                className="mt-6 inline-block text-[13px] font-medium text-brand-600 hover:text-brand-700"
              >
                Return to sign in
              </Link>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
