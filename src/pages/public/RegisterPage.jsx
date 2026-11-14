import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Logo from '../../components/ui/Logo.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', shopName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login: authLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Use the login function since registration+login happen together in demo mode
      // In production, this would call a register API endpoint
      await authLogin({ email: form.email, password: form.password });
      toast.success('Account created successfully!');
      navigate('/shop');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b border-line px-6 py-4">
        <Logo size={24} />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-[24px] font-semibold tracking-tight text-ink-900">Create your account</h1>
          <p className="mt-2 text-[14px] text-ink-500">
            Register your print shop on SmartPrint.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              label="Full name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Your name"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
            />
            <Input
              label="Shop name"
              name="shopName"
              value={form.shopName}
              onChange={handleChange}
              required
              placeholder="Your print shop name"
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-ink-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Log in
            </Link>
          </p>

          <p className="mt-4 text-center text-[11px] text-ink-400">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-ink-600">Terms</Link> and{' '}
            <Link to="/privacy" className="underline hover:text-ink-600">Privacy Policy</Link>.
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
