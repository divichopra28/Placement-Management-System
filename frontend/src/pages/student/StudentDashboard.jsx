import { Link } from 'react-router-dom';
import { Award, Briefcase, CalendarClock, CheckCircle2, Circle, ClipboardList, FileText, Target } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/AuthContext';
import { DataState, EmptyState, StatCard, StatusBadge } from '../../components/ui';
import { formatDate, formatDateTime, lpa } from '../../utils/format';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard/student');
  const firstName = user.name.split(' ')[0];

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <div className="page-head">
            <div>
              <h1>Welcome back, {firstName}</h1>
              <p>{data.profile.rollNo} · {data.profile.deptName} · Batch {data.profile.batchYear ?? '—'} · CGPA {data.profile.cgpa ?? '—'}</p>
            </div>
            <div className="page-actions">
              <Link to="/student/jobs" className="btn btn-primary"><Briefcase size={16} /> Browse drives</Link>
            </div>
          </div>

          {data.placement && (
            <div className="card card-pad" style={{ marginBottom: 20, background: 'var(--brown-dark)', borderColor: 'var(--brown-dark)', color: '#EDE0CE' }}>
              <div className="row" style={{ gap: 14 }}>
                <div className="stat-icon" style={{ background: '#A47551', color: '#FFF8EE' }}><Award size={20} /></div>
                <div className="grow" style={{ flex: 1 }}>
                  <div style={{ color: '#FFF8EE', fontWeight: 600, fontSize: 16 }}>Placed at {data.placement.companyName}</div>
                  <div className="small" style={{ color: '#CDB9A3' }}>{data.placement.jobTitle} · {lpa(data.placement.packageLpa)} · Joining {formatDate(data.placement.joiningDate)}</div>
                </div>
                <Link to="/student/placement" className="btn btn-secondary btn-sm">View details</Link>
              </div>
            </div>
          )}

          <div className="stats">
            <StatCard icon={Briefcase} label="Open drives" value={data.counts.openJobs} />
            <StatCard icon={Target} label="Eligible opportunities" value={data.counts.eligibleJobs} hint="Open drives you qualify for" />
            <StatCard icon={ClipboardList} label="Applications submitted" value={data.counts.applications} />
            <StatCard icon={CalendarClock} label="Upcoming interviews" value={data.counts.upcomingInterviews} />
            <StatCard icon={FileText} label="Pending offers" value={data.counts.pendingOffers} />
          </div>

          <div className="grid grid-3">
            <div className="card">
              <div className="card-head"><div><h2>Profile completion</h2><p>Based on the details stored in your record</p></div><strong className="num">{data.completion}%</strong></div>
              <div className="card-body">
                <div className="progress" role="progressbar" aria-valuenow={data.completion} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><span style={{ width: `${data.completion}%` }} /></div>
                <ul className="list" style={{ marginTop: 10 }}>
                  {data.completionItems.map((i) => (
                    <li key={i.label} style={{ padding: '7px 0' }}>
                      {i.done ? <CheckCircle2 size={16} color="var(--success)" /> : <Circle size={16} color="var(--muted)" />}
                      <span className={i.done ? '' : 'muted'}>{i.label}</span>
                    </li>
                  ))}
                </ul>
                {data.completion < 100 && <Link to="/student/profile" className="btn btn-secondary btn-sm mt">Complete profile</Link>}
              </div>
            </div>

            <div className="card">
              <div className="card-head"><div><h2>Eligible opportunities</h2><p>Open drives you can apply for now</p></div></div>
              {data.eligibleJobs.length === 0 ? (
                <EmptyState icon={Target} title="Nothing new right now" message="You've applied to every open drive you qualify for, or none match your profile yet." />
              ) : (
                <ul className="list">
                  {data.eligibleJobs.map((j) => (
                    <li key={j.jobId}>
                      <div className="grow">
                        <div className="title">{j.jobTitle}</div>
                        <div className="small muted">{j.companyName} · {lpa(j.salaryLpa)} · Apply by {formatDate(j.applicationDeadline)}</div>
                      </div>
                      <Link to={`/student/jobs?job=${j.jobId}`} className="btn btn-secondary btn-sm">View</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div className="card-head"><div><h2>Upcoming interviews</h2></div><Link to="/student/interviews" className="btn btn-ghost btn-sm">All</Link></div>
              {data.interviews.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No interviews scheduled" />
              ) : (
                <ul className="list">
                  {data.interviews.map((i) => {
                    const d = new Date(i.interviewDate);
                    return (
                      <li key={i.interviewId}>
                        <div className="date-box"><div className="m">{d.toLocaleString('en-IN', { month: 'short' })}</div><div className="d">{d.getDate()}</div></div>
                        <div className="grow">
                          <div className="title">{i.companyName} — {i.interviewType}</div>
                          <div className="small muted">Round {i.roundNo} · {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-2 mt">
            <div className="card">
              <div className="card-head"><div><h2>Recent applications</h2><p>From STUDENT_APPLICATION_VIEW</p></div><Link to="/student/applications" className="btn btn-ghost btn-sm">All</Link></div>
              {data.applications.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No applications yet" action={<Link to="/student/jobs" className="btn btn-primary btn-sm">Find a drive</Link>} />
              ) : (
                <ul className="list">
                  {data.applications.map((a, i) => (
                    <li key={i}>
                      <div className="grow"><div className="title">{a.jobTitle}</div><div className="small muted">{a.companyName} · Applied {formatDate(a.applyDate)}</div></div>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <div className="card-head"><div><h2>Latest status updates</h2><p>Recorded by the audit trigger</p></div></div>
              {data.updates.length === 0 ? (
                <EmptyState title="No status changes yet" message="When the placement cell updates one of your applications it will show up here." />
              ) : (
                <ul className="list">
                  {data.updates.map((u, i) => (
                    <li key={i}>
                      <div className="grow">
                        <div className="title">{u.jobTitle} · {u.companyName}</div>
                        <div className="small muted">{formatDateTime(u.changedOn)}</div>
                      </div>
                      <StatusBadge status={u.oldStatus} /> → <StatusBadge status={u.newStatus} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </DataState>
  );
}
