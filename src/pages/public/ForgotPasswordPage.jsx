import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/ui/Logo.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b border-line px-6 py-4">
        <Logo size={24} />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {!submitted ? (
            <>
              <h1 className="text-[24px] font-semibold tracking-tight text-ink-900">Reset password</h1>
              <p className="mt-2 text-[14px] text-ink-500">
                Enter your email and we will send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
                <Button type="submit" className="w-full" loading={loading}>
                  Send reset link
                </Button>
              </form>

              <p className="mt-6 text-center text-[13px] text-ink-500">
                Remember your password?{' '}
                <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
                  Log in
                </Link>
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-[18px] font-semibold text-ink-900">Check your email</h2>
              <p className="mt-2 text-[14px] text-ink-600">
                If an account exists for <strong>{email}</strong>, we have sent a password reset link.
              </p>
              <p className="mt-4 text-[13px] text-ink-500">
                Did not receive it? Check your spam folder or{' '}
                <button onClick={() => setSubmitted(false)} className="text-brand-600 hover:text-brand-700">
                  try again
                </button>.
              </p>
            </div>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
