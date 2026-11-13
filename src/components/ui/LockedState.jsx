import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import Button from './Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLE_LABEL = { shop: 'Shop Owner', admin: 'Super Admin' };

export function LockedState({ requiredRole, currentRole }) {
  const { logout } = useAuth();
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-warn/10 text-warn">
          <ShieldAlert className="size-5" strokeWidth={2} />
        </span>
        <h1 className="text-[18px] font-semibold text-ink-900">Restricted area</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
          This console is only available to{' '}
          <span className="font-medium text-ink-800">
            {ROLE_LABEL[requiredRole] ?? requiredRole}
          </span>{' '}
          accounts. You are signed in as{' '}
          <span className="font-medium text-ink-800">
            {ROLE_LABEL[currentRole] ?? 'a customer'}
          </span>
          .
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="secondary" onClick={logout}>
            Switch account
          </Button>
          <Button to="/" variant="primary">
            Back to home
          </Button>
        </div>
        <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
          Route protection is client-side in this preview. Production must verify role claims on
          every API request.
        </p>
      </div>
    </div>
  );
}

export function NotFoundState() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand-600">404</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-ink-900">
          Page not found
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
          The page you are looking for does not exist, or the QR code you scanned points to a
          machine that is no longer registered.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button to="/" variant="primary">
            Go to homepage
          </Button>
          <Button to="/print/SP-001" variant="secondary">
            Open demo print portal
          </Button>
        </div>
        <p className="mt-6 text-[11.5px] text-ink-400">
          Shop owner?{' '}
          <Link className="text-brand-600 hover:underline" to="/login">
            Sign in to your dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
