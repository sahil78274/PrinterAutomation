import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Logo from '../../components/ui/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { register as registerApi } from '../../services/api.js';
import { cn } from '../../lib/utils.js';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh',
];

const initialForm = {
  shopName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false,
};

export default function RegisterPage() {
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field when user types
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
    setServerError('');
  };

  const validate = () => {
    const newErrors = {};

    if (!form.shopName.trim()) newErrors.shopName = 'Shop name is required';
    if (!form.ownerName.trim()) newErrors.ownerName = 'Owner name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'Mobile number is required';
    } else {
      const digits = form.phone.replace(/[\s\-()+]/g, '').replace(/^91/, '');
      if (!/^[6-9]\d{9}$/.test(digits)) {
        newErrors.phone = 'Enter a valid 10-digit mobile number';
      }
    }
    if (!form.address.trim()) newErrors.address = 'Shop address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state) newErrors.state = 'State is required';
    if (!form.pincode.trim()) {
      newErrors.pincode = 'PIN code is required';
    } else if (!/^\d{6}$/.test(form.pincode)) {
      newErrors.pincode = 'PIN code must be 6 digits';
    }
    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[a-zA-Z]/.test(form.password)) {
      newErrors.password = 'Password must contain a letter';
    } else if (!/\d/.test(form.password)) {
      newErrors.password = 'Password must contain a number';
    }
    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!form.termsAccepted) {
      newErrors.termsAccepted = 'You must accept the Terms and Conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) {
      // Scroll to first error
      const firstError = Object.keys(errors)[0];
      if (firstError) {
        document.querySelector(`[name="${firstError}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setLoading(true);
    try {
      await registerApi({
        name: form.ownerName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
        shopName: form.shopName.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode.trim(),
        termsAccepted: true,
      });

      // Auto-login after registration
      try {
        await login({ email: form.email.trim(), password: form.password });
        toast({
          title: 'Welcome to SmartPrint!',
          description: `Your shop "${form.shopName}" has been registered successfully.`,
          type: 'success',
        });
        navigate('/shop', { replace: true });
      } catch {
        // If auto-login fails, show success and redirect to login
        setSuccess(true);
      }
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') {
        setErrors((prev) => ({ ...prev, email: 'An account with this email already exists' }));
      } else if (err.code === 'WEAK_PASSWORD') {
        setErrors((prev) => ({ ...prev, password: err.details?.password?.[0] || 'Password does not meet requirements' }));
      } else if (err.status === 0 || err.code === 'NETWORK_ERROR') {
        setServerError('Unable to connect to the server. Please check your connection and try again.');
      } else if (err.details) {
        // Map server validation errors to form fields
        const fieldErrors = {};
        if (err.details.email) fieldErrors.email = err.details.email;
        if (err.details.password) fieldErrors.password = Array.isArray(err.details.password) ? err.details.password[0] : err.details.password;
        if (err.details.name) fieldErrors.ownerName = err.details.name;
        if (err.details.shopName) fieldErrors.shopName = err.details.shopName;
        if (err.details.phone) fieldErrors.phone = err.details.phone;
        setErrors(fieldErrors);
      } else {
        setServerError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-5 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-md text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h1 className="mt-5 text-[24px] font-semibold tracking-tight text-ink-900">
            Registration successful!
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-600">
            Your shop has been registered. You can now sign in with your credentials.
          </p>
          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={() => navigate('/login')}
            iconRight={ArrowRight}
          >
            Go to sign in
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-line px-5 py-4 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo size={28} />
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink-900">
            Register your shop
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
            Set up your print shop on SmartPrint. Fill in the details below to create your account.
          </p>

          {serverError && (
            <div className="mt-5 rounded-lg border border-danger/25 bg-danger/[0.05] px-4 py-3 text-[13px] text-danger">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* Shop Information */}
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Shop information</h2>
              <p className="mt-1 text-[12.5px] text-ink-500">Tell us about your print shop.</p>

              <div className="mt-5 space-y-4">
                <Field
                  label="Shop name"
                  name="shopName"
                  value={form.shopName}
                  onChange={update('shopName')}
                  error={errors.shopName}
                  placeholder="e.g. Sharma Digital Press"
                  required
                />
                <Field
                  label="Owner full name"
                  name="ownerName"
                  value={form.ownerName}
                  onChange={update('ownerName')}
                  error={errors.ownerName}
                  placeholder="Your full name"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Business email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={update('email')}
                    error={errors.email}
                    placeholder="you@example.com"
                    required
                  />
                  <Field
                    label="Mobile number"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={update('phone')}
                    error={errors.phone}
                    placeholder="9876543210"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Shop address</h2>
              <p className="mt-1 text-[12.5px] text-ink-500">Where is your shop located?</p>

              <div className="mt-5 space-y-4">
                <Field
                  label="Street address"
                  name="address"
                  value={form.address}
                  onChange={update('address')}
                  error={errors.address}
                  placeholder="Shop number, street, landmark"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="City"
                    name="city"
                    value={form.city}
                    onChange={update('city')}
                    error={errors.city}
                    placeholder="e.g. Hisar"
                    required
                  />
                  <div>
                    <label htmlFor="state" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                      State <span className="text-danger">*</span>
                    </label>
                    <select
                      id="state"
                      name="state"
                      value={form.state}
                      onChange={update('state')}
                      className={cn(
                        'h-11 w-full rounded-lg border bg-white px-3 text-[13.5px] text-ink-900',
                        'transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
                        errors.state ? 'border-danger' : 'border-line',
                      )}
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {errors.state && <p className="mt-1 text-[11.5px] text-danger">{errors.state}</p>}
                  </div>
                  <Field
                    label="PIN code"
                    name="pincode"
                    value={form.pincode}
                    onChange={update('pincode')}
                    error={errors.pincode}
                    placeholder="125001"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Account Security */}
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Account security</h2>
              <p className="mt-1 text-[12.5px] text-ink-500">Create a secure password for your account.</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                    Password <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={update('password')}
                      placeholder="At least 8 characters"
                      className={cn(
                        'h-11 w-full rounded-lg border bg-white px-3 pr-10 text-[13.5px] text-ink-900 placeholder:text-ink-400',
                        'transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
                        errors.password ? 'border-danger' : 'border-line',
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
                  {errors.password && <p className="mt-1 text-[11.5px] text-danger">{errors.password}</p>}
                  <p className="mt-1.5 text-[11px] text-ink-400">
                    Must be at least 8 characters with a letter and a number.
                  </p>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
                    Confirm password <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={update('confirmPassword')}
                      placeholder="Re-enter your password"
                      className={cn(
                        'h-11 w-full rounded-lg border bg-white px-3 pr-10 text-[13.5px] text-ink-900 placeholder:text-ink-400',
                        'transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
                        errors.confirmPassword ? 'border-danger' : 'border-line',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-[11.5px] text-danger">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.termsAccepted}
                  onChange={update('termsAccepted')}
                  className="mt-0.5 size-4 rounded border-line-strong accent-brand-600"
                />
                <span className="text-[12.5px] text-ink-600">
                  I agree to the{' '}
                  <Link to="/terms" className="font-medium text-brand-600 hover:underline" target="_blank">
                    Terms and Conditions
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="font-medium text-brand-600 hover:underline" target="_blank">
                    Privacy Policy
                  </Link>.
                  {errors.termsAccepted && (
                    <span className="block text-danger">{errors.termsAccepted}</span>
                  )}
                </span>
              </label>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={loading}
              iconRight={ArrowRight}
            >
              Create account
            </Button>

            <p className="text-center text-[12.5px] text-ink-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                Sign in
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, name, type = 'text', value, onChange, error, placeholder, required, maxLength }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-[12.5px] font-medium text-ink-700">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(
          'h-11 w-full rounded-lg border bg-white px-3 text-[13.5px] text-ink-900 placeholder:text-ink-400',
          'transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10',
          error ? 'border-danger' : 'border-line',
        )}
      />
      {error && <p className="mt-1 text-[11.5px] text-danger">{error}</p>}
    </div>
  );
}
