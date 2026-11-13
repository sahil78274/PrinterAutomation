import { Component } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import Button from './Button.jsx';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production this would report to an error tracker (Sentry, etc.).
    // eslint-disable-next-line no-console
    console.error('[SmartPrint] Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[60vh] place-items-center px-6">
          <div className="card max-w-md p-8 text-center">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-danger/10 text-danger">
              <TriangleAlert className="size-5" strokeWidth={2} />
            </span>
            <h1 className="text-[18px] font-semibold text-ink-900">Something went wrong</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
              This screen hit an unexpected error and was stopped before it could break the rest of
              the app.
            </p>
            <pre className="mt-3 max-h-28 overflow-auto rounded-lg bg-surface-sunken p-2.5 text-left font-mono text-[10.5px] leading-relaxed text-ink-600">
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="secondary" onClick={() => this.setState({ error: null })}>
                Try again
              </Button>
              <Button onClick={() => window.location.assign('/')} icon={RotateCcw}>
                Back to home
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
