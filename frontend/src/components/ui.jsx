import { Component } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, Inbox, Loader2, XCircle } from 'lucide-react';

const STATUS_TONE = {
  APPLIED: 'info',
  SHORTLISTED: 'warning',
  SELECTED: 'success',
  REJECTED: 'error',
  WITHDRAWN: 'muted',
  PENDING: 'warning',
  PASS: 'success',
  FAIL: 'error',
  ACCEPTED: 'success',
  CONFIRMED: 'success',
  OPEN: 'success',
  CLOSED: 'muted',
  ELIGIBLE: 'success',
  INELIGIBLE: 'error',
};

export function StatusBadge({ status }) {
  if (!status) return <span className="muted">—</span>;
  const tone = STATUS_TONE[status] || 'neutral';
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Loader({ label = 'Loading…' }) {
  return (
    <div className="loader" role="status">
      <Loader2 size={18} className="spin" /> {label}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={24} /></div>
      <h3>{title}</h3>
      {message && <p className="small" style={{ maxWidth: 420, margin: '0 auto' }}>{message}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  const Icon = type === 'success' ? CheckCircle2 : type === 'info' ? HelpCircle : AlertCircle;
  return <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}><Icon size={16} /><div>{children}</div></div>;
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card-pad">
      <Alert type="error">
        {message}{' '}
        {onRetry && <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={onRetry}>Retry</button>}
      </Alert>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="card stat">
      {Icon && <div className="stat-icon"><Icon size={19} /></div>}
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value ?? '—'}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

export function Field({ label, required, error, hint, children, full, htmlFor }) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      {label && <label htmlFor={htmlFor}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>}
      {children}
      {error ? <span className="err" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function CheckIcon({ status }) {
  if (status === 'PASS') return <CheckCircle2 size={17} color="var(--success)" aria-label="Met" />;
  if (status === 'FAIL') return <XCircle size={17} color="var(--error)" aria-label="Not met" />;
  return <HelpCircle size={17} color="var(--warning)" aria-label="Unknown" />;
}

/** Card wrapper that handles the loading / error / empty states consistently. */
export function DataState({ loading, error, onRetry, empty, emptyProps, children }) {
  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState {...emptyProps} />;
  return children;
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card card-pad" style={{ margin: 24 }}>
          <EmptyState
            icon={AlertCircle}
            title="Something went wrong on this page"
            message={String(this.state.error.message || this.state.error)}
            action={<button type="button" className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.reload(); }}>Reload page</button>}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
