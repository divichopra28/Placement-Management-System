import { Link } from 'react-router-dom';
import {
  Award, Briefcase, Building2, CalendarClock, CheckCircle2, ClipboardList, FileClock, FileCheck2,
  IndianRupee, Percent, Star, TrendingUp, UserCheck, Users,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { DataState, EmptyState, StatCard, StatusBadge } from '../../components/ui';
import { Bars, HBars, Legend, Lines } from '../../components/Charts';
import { formatDateTime, lpa } from '../../utils/format';

const STATUS_ORDER = ['APPLIED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'WITHDRAWN'];

function ChartCard({ title, subtitle, legend, children, empty }) {
  return (
    <div className="card">
      <div className="card-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{legend}</div>
      <div className="card-body">{empty ? <EmptyState title="No data yet" message={empty} /> : children}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi('/dashboard/admin');

  return (
    <DataState loading={loading && !data} error={error} onRetry={reload}>
      {data && (() => {
        const t = data.totals;
        const byStatus = STATUS_ORDER.map((s) => ({ status: s.charAt(0) + s.slice(1).toLowerCase(), count: data.applicationsByStatus.find((x) => x.status === s)?.count || 0 }));
        const months = data.monthlyTrend.map((m) => ({ ...m, label: new Date(`${m.month}-01T00:00`).toLocaleString('en-IN', { month: 'short', year: '2-digit' }) }));
        const hasPlacements = t.placed > 0;
        return (
          <>
            <div className="page-head">
              <div><h1>Placement overview</h1><p>Live figures from the Oracle database · placement % from PLACEMENT_PERCENTAGE()</p></div>
              <div className="page-actions">
                <button type="button" className="btn btn-secondary" onClick={reload}>Refresh</button>
                <Link to="/admin/reports" className="btn btn-primary">Open reports</Link>
              </div>
            </div>

            <div className="stats">
              <StatCard icon={Users} label="Registered students" value={t.students} />
              <StatCard icon={Building2} label="Companies" value={t.companies} />
              <StatCard icon={Briefcase} label="Job postings" value={t.jobs} hint={`${t.openJobs} open for applications`} />
              <StatCard icon={ClipboardList} label="Applications" value={t.applications} />
              <StatCard icon={Star} label="Shortlisted" value={t.shortlisted} />
              <StatCard icon={UserCheck} label="Selected" value={t.selected} />
              <StatCard icon={FileClock} label="Offers pending" value={t.offersPending} />
              <StatCard icon={FileCheck2} label="Offers accepted" value={t.offersAccepted} />
              <StatCard icon={Award} label="Students placed" value={t.placed} />
              <StatCard icon={Percent} label="Placement percentage" value={`${t.placementPercentage ?? 0}%`} hint="Placed / registered students" />
              <StatCard icon={IndianRupee} label="Average package" value={t.avgPackage != null ? lpa(t.avgPackage) : '—'} hint={t.avgPackage == null ? 'No placements yet' : undefined} />
              <StatCard icon={TrendingUp} label="Highest package" value={t.maxPackage != null ? lpa(t.maxPackage) : '—'} hint={t.maxPackage == null ? 'No placements yet' : undefined} />
            </div>

            <div className="grid grid-2">
              <ChartCard title="Applications by status" subtitle="All applications" empty={t.applications === 0 && 'No applications have been submitted.'}>
                <Bars data={byStatus} xKey="status" series={[{ key: 'count', name: 'Applications' }]} />
              </ChartCard>
              <ChartCard title="Monthly trend" subtitle="Applications and placements, last 6 months" legend={<Legend items={['Applications', 'Placements']} />}>
                <Lines data={months} xKey="label" series={[{ key: 'applications', name: 'Applications' }, { key: 'placements', name: 'Placements' }]} />
              </ChartCard>
              <ChartCard title="Placements by department" subtitle="Students vs. placed" legend={<Legend items={['Students', 'Placed']} />}>
                <Bars data={data.placementsByDepartment} xKey="deptName" series={[{ key: 'students', name: 'Students' }, { key: 'placed', name: 'Placed' }]} />
              </ChartCard>
              <ChartCard title="Placements by company" subtitle="Confirmed placements" empty={!hasPlacements && 'Placements appear once students accept offers.'}>
                <HBars data={data.placementsByCompany.filter((c) => c.placed > 0)} yKey="companyName" valueKey="placed" name="Placed" />
              </ChartCard>
              <ChartCard title="Package distribution" subtitle="Placed students by package band" empty={!hasPlacements && 'No placement packages recorded yet.'}>
                <Bars data={data.packageDistribution} xKey="bucket" series={[{ key: 'count', name: 'Students' }]} />
              </ChartCard>
              <ChartCard title="Applicants per job" subtitle="All job postings" empty={data.jobApplicants.length === 0 && 'No job postings yet.'}>
                <HBars data={data.jobApplicants} yKey="jobLabel" valueKey="applicants" name="Applicants" />
              </ChartCard>
            </div>

            <div className="grid grid-2 mt">
              <div className="card">
                <div className="card-head"><h2>Upcoming interviews</h2><Link to="/admin/interviews" className="btn btn-ghost btn-sm">All</Link></div>
                {data.upcomingInterviews.length === 0 ? <EmptyState icon={CalendarClock} title="Nothing scheduled" /> : (
                  <ul className="list">
                    {data.upcomingInterviews.map((i) => (
                      <li key={i.interviewId}>
                        <div className="grow"><div className="title">{i.studentName} — {i.companyName}</div><div className="small muted">{i.jobTitle} · {i.interviewType} · Round {i.roundNo}</div></div>
                        <span className="small nowrap">{formatDateTime(i.interviewDate)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card">
                <div className="card-head"><h2>Recent status changes</h2><Link to="/admin/audit" className="btn btn-ghost btn-sm">Audit log</Link></div>
                {data.recentActivity.length === 0 ? <EmptyState icon={CheckCircle2} title="No changes recorded yet" /> : (
                  <ul className="list">
                    {data.recentActivity.map((a) => (
                      <li key={a.auditId}>
                        <div className="grow"><div className="title">{a.studentName}</div><div className="small muted">{a.jobTitle} · {formatDateTime(a.changedOn)}</div></div>
                        <StatusBadge status={a.oldStatus} /> → <StatusBadge status={a.newStatus} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </DataState>
  );
}
