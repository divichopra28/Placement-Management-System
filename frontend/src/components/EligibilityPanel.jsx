import { CheckIcon } from './ui';

export default function EligibilityPanel({ result, compact }) {
  if (!result) return null;
  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <span className={`badge ${result.eligible ? 'badge-success' : 'badge-error'}`}>{result.eligible ? 'Eligible' : 'Not eligible'}</span>
        {!compact && result.applicationOpen === false && <span className="badge badge-muted">Applications closed</span>}
      </div>
      {result.checks.map((c) => (
        <div className="check-row" key={c.key}>
          <CheckIcon status={c.status} />
          <div>
            <strong style={{ fontSize: 13 }}>{c.label}</strong>
            <div className="small muted">{c.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
