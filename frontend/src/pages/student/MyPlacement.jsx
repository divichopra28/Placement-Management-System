import { Link } from 'react-router-dom';
import { Award, Printer } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/AuthContext';
import { DataState, EmptyState, PageHeader, StatusBadge } from '../../components/ui';
import { formatDate, lpa } from '../../utils/format';

export default function MyPlacement() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/placements', { initial: [] });
  const placement = data[0];

  return (
    <>
      <PageHeader
        title="My placement"
        subtitle="Your confirmed placement, created automatically when you accepted an offer."
        actions={placement && <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}><Printer size={16} /> Print / save as PDF</button>}
      />
      <DataState loading={loading && !data.length} error={error} onRetry={reload}>
        {!placement ? (
          <div className="card">
            <EmptyState icon={Award} title="Not placed yet" message="Once you accept an offer, your placement record appears here automatically." action={<Link to="/student/offers" className="btn btn-primary">View my offers</Link>} />
          </div>
        ) : (
          <div className="card" style={{ maxWidth: 760 }}>
            <div className="card-head" style={{ background: 'var(--brown-dark)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
              <div className="row" style={{ gap: 14 }}>
                <div className="stat-icon" style={{ background: '#A47551', color: '#FFF8EE' }}><Award size={20} /></div>
                <div>
                  <h2 style={{ color: '#FFF8EE' }}>{placement.companyName}</h2>
                  <p style={{ color: '#CDB9A3' }}>{placement.jobTitle}</p>
                </div>
              </div>
              <StatusBadge status={placement.placementStatus} />
            </div>
            <div className="card-body">
              <dl className="dl">
                <dt>Student</dt><dd>{user.name} ({placement.rollNo})</dd>
                <dt>Department</dt><dd>{placement.deptName}</dd>
                <dt>Package</dt><dd>{lpa(placement.packageLpa)}</dd>
                <dt>CTC</dt><dd>{lpa(placement.ctc)}</dd>
                <dt>Offer date</dt><dd>{formatDate(placement.offerDate)}</dd>
                <dt>Placed on</dt><dd>{formatDate(placement.placedOn)}</dd>
                <dt>Joining date</dt><dd>{formatDate(placement.joiningDate)}</dd>
                <dt>Placement ID</dt><dd>#{placement.placementId}</dd>
              </dl>
            </div>
          </div>
        )}
      </DataState>
    </>
  );
}
