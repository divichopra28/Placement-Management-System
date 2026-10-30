import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Award, BarChart3, Bell, Briefcase, Building2, CalendarClock, ClipboardList,
  FileText, GraduationCap, History, LayoutDashboard, ListChecks, LogOut, Menu, Sparkles, User, Users, X,
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import api from '../services/api';
import { formatDateTime, initials } from '../utils/format';
import { useFeedback } from '../components/Feedback';

export const STUDENT_NAV = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/profile', label: 'My Profile', icon: User },
  { to: '/student/skills', label: 'My Skills', icon: Sparkles },
  { to: '/student/companies', label: 'Companies', icon: Building2 },
  { to: '/student/jobs', label: 'Jobs and Drives', icon: Briefcase },
  { to: '/student/applications', label: 'My Applications', icon: ClipboardList },
  { to: '/student/interviews', label: 'Interviews', icon: CalendarClock },
  { to: '/student/offers', label: 'Offers', icon: FileText },
  { to: '/student/placement', label: 'My Placement', icon: Award },
];

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/jobs', label: 'Job and Drive Management', icon: Briefcase },
  { to: '/admin/eligibility', label: 'Eligibility Management', icon: ListChecks },
  { to: '/admin/applications', label: 'Applications', icon: ClipboardList },
  { to: '/admin/interviews', label: 'Interviews', icon: CalendarClock },
  { to: '/admin/offers', label: 'Offers', icon: FileText },
  { to: '/admin/placements', label: 'Placements', icon: Award },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/audit', label: 'Audit Logs', icon: History },
];

function Notifications({ role }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const load = async () => {
    try {
      if (role === 'STUDENT') {
        const { data } = await api.get('/dashboard/student');
        const list = [
          ...data.interviews.map((i) => ({ when: i.interviewDate, text: `Upcoming ${i.interviewType} interview (round ${i.roundNo}) — ${i.companyName}` })),
          ...data.updates.map((u) => ({ when: u.changedOn, text: `${u.jobTitle} at ${u.companyName}: ${u.oldStatus} → ${u.newStatus}` })),
        ];
        if (data.counts.pendingOffers) list.unshift({ when: null, text: `You have ${data.counts.pendingOffers} pending offer(s) awaiting a response.` });
        setItems(list.slice(0, 8));
      } else {
        const { data } = await api.get('/dashboard/admin');
        const list = data.recentActivity.map((a) => ({ when: a.changedOn, text: `${a.studentName} — ${a.jobTitle}: ${a.oldStatus} → ${a.newStatus}` }));
        if (data.totals.offersPending) list.unshift({ when: null, text: `${data.totals.offersPending} offer(s) are pending a decision.` });
        if (data.totals.upcomingInterviews) list.unshift({ when: null, text: `${data.totals.upcomingInterviews} interview(s) are scheduled ahead.` });
        setItems(list.slice(0, 8));
      }
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="btn btn-secondary icon-btn" style={{ position: 'relative' }} aria-label="Notifications" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) load(); }}>
        <Bell size={17} />
        {items?.length > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="dropdown-menu">
          <div className="head">Notifications</div>
          {items === null ? <div className="notif muted">Loading…</div>
            : items.length === 0 ? <div className="notif muted">You're all caught up.</div>
              : items.map((n, i) => (
                <div className="notif" key={i}>
                  <div>{n.text}</div>
                  {n.when && <div className="when">{formatDateTime(n.when)}</div>}
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { confirm } = useFeedback();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const nav = user.role === 'OFFICER' ? ADMIN_NAV : STUDENT_NAV;
  const current = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => location.pathname.startsWith(n.to));

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => { document.title = `${current?.label || 'Portal'} · Placement Cell`; }, [current]);

  const doLogout = async () => {
    const ok = await confirm({ title: 'Log out?', message: 'You will need to sign in again to access the portal.', confirmLabel: 'Log out' });
    if (!ok) return;
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="brand-mark"><GraduationCap size={20} /></div>
          <div className="brand-text">
            <strong>Placement Cell</strong>
            <span>{user.role === 'OFFICER' ? 'Officer console' : 'Student portal'}</span>
          </div>
          <button type="button" className="btn btn-ghost icon-btn menu-btn" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">{user.role === 'OFFICER' ? 'Administration' : 'My placement'}</div>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <n.icon size={17} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="nav-link" onClick={doLogout}><LogOut size={17} /> Logout</button>
        </div>
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="main">
        <header className="topbar">
          <button type="button" className="btn btn-secondary icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <div className="topbar-title">
            <h1>{current?.label || 'Placement Cell'}</h1>
            <p>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <Notifications role={user.role} />
          <div className="user-chip">
            <div className="avatar" aria-hidden="true">{initials(user.name)}</div>
            <div className="who">
              <strong>{user.name}</strong>
              <span>{user.collegeId}{user.subtitle ? ` · ${user.subtitle}` : ''}</span>
            </div>
          </div>
          <button type="button" className="btn btn-secondary icon-btn" onClick={doLogout} aria-label="Log out" title="Log out"><LogOut size={17} /></button>
        </header>
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

