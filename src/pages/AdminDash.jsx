import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard, Map, BarChart2, ClipboardList, Zap, Users,
  CheckSquare, Settings, HelpCircle, LogOut, ShieldCheck,
  UserCog, Activity, AlertTriangle, RefreshCw, Search, Trash2, X,
  Menu, Download, MessageCircle, Check,
} from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { useInterest } from '../hooks/useInterest';
import LiveMap from '../components/LiveMap';
import UrgencyScoreBadge from '../components/UrgencyScoreBadge';
import { API_BASE_URL } from '../config/api';
import { getWhatsAppEmergencyUrl } from '../utils/whatsapp';

// ── Sidebar ────────────────────────────────────────────────────────────────
function AdminSidebar({ mobileOpen, onClose }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const path = window.location.pathname;

  const handleNav = (itemPath) => {
    navigate(itemPath);
    if (onClose) onClose();
  };

  const navItems = {
    OVERVIEW: [
      { name: 'Admin Overview', icon: LayoutDashboard, path: '/admin-dash' },
      { name: 'Live Map', icon: Map, path: '/admin-dash/map' },
      { name: 'Insights', icon: BarChart2, path: '/admin-dash/insights' },
    ],
    OPERATIONS: [
      { name: 'Report a Need', icon: ClipboardList, path: '/needs-intake' },
      { name: 'My Requests', icon: Activity, path: '/admin-dash/my-requests' },
      { name: 'Priorities', icon: Zap, path: '/admin-dash/priorities' },
      { name: 'Volunteers', icon: Users, path: '/admin-dash/volunteers' },
      { name: 'Tasks', icon: CheckSquare, path: '/admin-dash/priorities' },
    ],
    'USER MANAGEMENT': [
      { name: 'User Roles', icon: UserCog, path: '/admin-dash' },
    ],
    SYSTEM: [
      { name: 'Settings', icon: Settings, path: '/admin-dash/settings' },
      { name: 'Support', icon: HelpCircle, path: '/admin-dash/support' },
    ],
  };

  const sidebarContent = (
    <div className="w-64 flex-shrink-0 bg-zinc-950/95 border-r border-[rgba(255,255,255,0.06)] h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] bg-[#34D399] flex items-center justify-center flex-shrink-0">
            <span className="text-[#09090B] font-black text-sm">SR</span>
          </div>
          <span className="font-extrabold text-white tracking-[-0.05em]">SmartRelief</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-zinc-400 hover:text-white p-1 rounded-lg"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="px-2 mb-6">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#34D399]/10 border border-[#34D399]/20 text-[#34D399] text-[10px] font-semibold">
          <ShieldCheck size={10} /> Admin Panel
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Object.entries(navItems).map(([section, items]) => (
          <div key={section}>
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest px-3 mb-2 mt-5">{section}</p>
            <div className="space-y-1">
              {items.map((item) => {
                const active = path === item.path || (item.path !== '/admin-dash' && path.startsWith(item.path));
                return (
                  <button key={item.path} onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition cursor-pointer ${active ? 'bg-[#34D399]/10 text-[#34D399] font-semibold border border-[#34D399]/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
                    <item.icon size={18} />{item.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-5 border-t border-white/6">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] bg-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#34D399]/40 to-[#34D399]/10 flex items-center justify-center text-[#34D399] text-xs font-bold flex-shrink-0">
            {currentUser?.displayName?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{currentUser?.displayName ?? 'Admin'}</p>
            <p className="text-zinc-500 text-[10px] truncate">{currentUser?.email}</p>
          </div>
          <button onClick={() => signOut(auth).then(() => navigate('/', { replace: true }))} title="Sign Out">
            <LogOut size={14} className="text-zinc-600 hover:text-zinc-300 transition" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile drawer with backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-10 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

// ── Shared auth-loading spinner ───────────────────────────────────────────
function AuthSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="w-7 h-7 rounded-full border-2 border-[#34D399] border-t-transparent animate-spin" />
    </div>
  );
}

// ── Urgency color map ──────────────────────────────────────────────────────
const URGENCY_COLORS = {
  low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

// ── Section A: Metrics Bar (live) ──────────────────────────────────────────
function MetricsBar({ refreshKey }) {
  const { currentUser, roleLoading } = useAuth();
  const [stats, setStats] = useState(null);
  const [fetchState, setFetchState] = useState('loading'); // loading | done | stale

  const fetchStats = useCallback(async () => {
    if (!currentUser || roleLoading) return;
    setFetchState('loading');
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!res.ok) throw new Error('non-200');
      const data = await res.json();
      setStats(data);
      setFetchState('done');
    } catch {
      setFetchState((prev) => (prev === 'done' || prev === 'stale' ? 'stale' : 'error'));
    }
  }, [currentUser, roleLoading]);

  useEffect(() => {
    if (!currentUser || roleLoading) return;
    fetchStats();
  }, [fetchStats, currentUser, roleLoading, refreshKey]);

  if (roleLoading || currentUser === undefined) return <AuthSpinner />;

  const cards = [
    {
      label: 'Total Needs Reported',
      key: 'total_needs',
      icon: ClipboardList,
      color: 'text-[#34D399]',
    },
    {
      label: 'Urgent (Critical + High)',
      key: 'urgent_needs',
      icon: AlertTriangle,
      color: 'text-orange-400',
    },
    {
      label: 'Volunteers in Pool',
      key: 'total_volunteers',
      icon: Users,
      color: 'text-blue-400',
    },
    {
      label: 'Completions This Month',
      key: 'completions_this_month',
      icon: Activity,
      color: 'text-purple-400',
    },
    {
      label: 'Total Lives Impacted',
      key: 'total_lives_impacted',
      icon: Users,
      color: 'text-pink-400',
    },
    {
      label: 'Active Emergencies',
      key: 'active_emergencies',
      icon: AlertTriangle,
      color: 'text-red-400',
    },
    {
      label: 'Completed Missions',
      key: 'completed_missions',
      icon: CheckSquare,
      color: 'text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
      {cards.map((c) => {
        const value = stats?.[c.key];
        const isLoading = fetchState === 'loading' && value == null;

        return (
          <GlassCard key={c.label} className="rounded-[20px] p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-3">
              <c.icon size={18} className={c.color} />
              {fetchState === 'stale' && (
                <span className="text-[9px] text-yellow-500/70 font-semibold">stale</span>
              )}
            </div>
            {isLoading ? (
              <div className="h-8 w-16 rounded-[8px] bg-white/8 animate-pulse mb-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {value?.toLocaleString() ?? '—'}
              </p>
            )}
            <p className="text-zinc-500 text-xs mt-1 leading-tight">{c.label}</p>
          </GlassCard>
        );
      })}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatIST(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Section B: Recent Needs (with admin delete, CSV export, WhatsApp SOS) ──
function RecentNeeds({ onStatsRefresh }) {
  const { currentUser, roleLoading } = useAuth();
  const [needs, setNeeds] = useState([]);
  const [fetchState, setFetchState] = useState('loading');
  const [filterTab, setFilterTab] = useState('all'); // all | active | completed
  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [volNames, setVolNames] = useState({});
  const [toast, setToast] = useState(null);
  const { interestLoading, interestedMissions, handleInterest } = useInterest(currentUser, setToast);

  const fetchNeeds = useCallback(async () => {
    if (!currentUser || roleLoading) return;
    setFetchState('loading');
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(
        `${API_BASE_URL}/api/needs?limit=50&sort=created_at&status=all`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      if (!res.ok) throw new Error('non-200');
      const data = await res.json();
      const items = (data.needs ?? [])
        .slice()
        .sort((a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0));
      setNeeds(items);
      setFetchState('done');

      // Batch lookup volunteer display names
      const uids = [...new Set(
        items
          .filter((n) => n.completed_by || n.assigned_volunteers)
          .flatMap((n) => [...(n.completed_by || []), ...(n.assigned_volunteers || [])])
      )];
      if (uids.length > 0) {
        try {
          const uRes = await fetch(`${API_BASE_URL}/api/users`);
          if (uRes.ok) {
            const uData = await uRes.json();
            const map = {};
            (uData.users ?? []).forEach((u) => {
              if (uids.includes(u.uid)) {
                map[u.uid] = u.displayName || u.name || u.email || u.uid.slice(0, 8);
              }
            });
            setVolNames(map);
          }
        } catch { /* non-critical */ }
      }
    } catch {
      setFetchState('error');
    }
  }, [currentUser, roleLoading]);

  useEffect(() => {
    if (!currentUser || roleLoading) return;
    fetchNeeds();
  }, [fetchNeeds, currentUser, roleLoading]);

  if (roleLoading || currentUser === undefined) return <AuthSpinner />;

  // Filter calculations
  const activeNeeds = needs.filter(n => n.status !== 'completed' && n.status !== 'resolved');
  const completedNeeds = needs.filter(n => n.status === 'completed' || n.status === 'resolved');

  const displayedNeeds = filterTab === 'active'
    ? activeNeeds
    : filterTab === 'completed'
    ? completedNeeds
    : needs;

  const handleDelete = async (needId) => {
    if (!currentUser) return;
    setDeleteLoading(true);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/needs/${needId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setNeeds((prev) => prev.filter((n) => n.id !== needId));
      setDeletingId(null);
      if (onStatsRefresh) onStatsRefresh();
    } catch (err) {
      console.error('[AdminDash] Delete failed:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResolve = async (needId) => {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/needs/${needId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error('Resolve failed');
      // Optimistically update
      setNeeds((prev) =>
        prev.map((n) =>
          n.id === needId ? { ...n, status: 'completed', task_status: 'completed' } : n
        )
      );
      // Re-fetch both needs and stats
      await fetchNeeds();
      if (onStatsRefresh) onStatsRefresh();
    } catch (err) {
      console.error('[AdminDash] Resolve failed:', err);
    }
  };

  // Real CSV SitRep Export
  const handleExportCSV = () => {
    if (!needs || needs.length === 0) return;
    const headers = [
      'ID',
      'Reported At (IST)',
      'Reporter Name',
      'Contact Phone',
      'Contact Email',
      'Location',
      'Latitude',
      'Longitude',
      'Urgency',
      'Urgency Score',
      'People Affected',
      'Description',
      'Status',
      'Task Status',
      'Assigned Volunteers'
    ];

    const escapeCSV = (val) => {
      if (val == null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = needs.map(n => [
      escapeCSV(n.id),
      escapeCSV(formatIST(n.created_at)),
      escapeCSV(n.reporter_name || ''),
      escapeCSV(n.contact_phone || ''),
      escapeCSV(n.contact_email || ''),
      escapeCSV(n.location || ''),
      escapeCSV(n.lat ?? ''),
      escapeCSV(n.lng ?? ''),
      escapeCSV(n.urgency || ''),
      escapeCSV(n.urgency_score ?? ''),
      escapeCSV(n.people_affected ?? n.headcount ?? 1),
      escapeCSV(n.needs_description || ''),
      escapeCSV(n.status || ''),
      escapeCSV(n.task_status || ''),
      escapeCSV((n.assigned_volunteers || n.completed_by || []).join(', '))
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `SmartRelief_SitRep_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const TASK_PILL = {
    assigned:        'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    open:            'bg-zinc-500/10 text-zinc-400 border border-zinc-600/20',
    pending_briefing:'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    in_progress:     'bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/20',
    completed:       'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  };

  return (
    <GlassCard className="rounded-[24px] p-4 sm:p-6 col-span-12">
      {/* Header with Title, Filter Tabs, CSV Export, Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-white font-bold text-base sm:text-lg">Recent Needs</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Live emergency submissions with verified urgency scores.</p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Filter Pills */}
          <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-full p-1 text-xs">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-[#34D399] text-[#09090B]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All ({needs.length})
            </button>
            <button
              onClick={() => setFilterTab('active')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                filterTab === 'active'
                  ? 'bg-[#34D399] text-[#09090B]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Active ({activeNeeds.length})
            </button>
            <button
              onClick={() => setFilterTab('completed')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                filterTab === 'completed'
                  ? 'bg-[#34D399] text-[#09090B]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Completed ({completedNeeds.length})
            </button>
          </div>

          {/* Real CSV SitRep Export */}
          <button
            onClick={handleExportCSV}
            disabled={needs.length === 0}
            className="flex items-center gap-1.5 border border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399] text-xs px-3 py-1.5 rounded-full hover:bg-[#34D399]/20 transition disabled:opacity-40 cursor-pointer"
            title="Download complete operational SitRep in CSV"
          >
            <Download size={12} />
            Export SitRep (CSV)
          </button>

          {/* Refresh button */}
          <button
            onClick={fetchNeeds}
            className="flex items-center gap-1.5 border border-white/8 text-zinc-400 text-xs px-3 py-1.5 rounded-full hover:text-white transition cursor-pointer"
          >
            <RefreshCw size={11} />
            Refresh
          </button>
        </div>
      </div>

      {fetchState === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[12px] bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {fetchState === 'error' && (
        <div className="flex items-center justify-between text-zinc-400 text-sm py-6">
          <span>Failed to load needs from API.</span>
          <button onClick={fetchNeeds} className="text-[#34D399] hover:underline text-xs">Retry</button>
        </div>
      )}

      {fetchState === 'done' && displayedNeeds.length === 0 && (
        <p className="text-zinc-500 text-sm text-center py-8">
          {filterTab === 'active' ? 'No active emergencies pending response.' : filterTab === 'completed' ? 'No completed missions recorded yet.' : 'No needs submitted yet.'}
        </p>
      )}

      {fetchState === 'done' && displayedNeeds.length > 0 && (
        <div className="divide-y divide-white/5">
          {displayedNeeds.map((n) => {
            const displayUrgency = n.computed_urgency ?? n.urgency ?? 'low';
            const truncated = n.needs_description ?? 'Untitled Emergency Need';
            const isDeleting = deletingId === n.id;
            const isCompleted = n.status === 'completed' || n.status === 'resolved';
            const assignedName = n.completed_by?.length
              ? n.completed_by.map(uid => volNames[uid] ?? '…').join(', ')
              : n.assigned_volunteers?.length
              ? n.assigned_volunteers.map(uid => volNames[uid] ?? '…').join(', ')
              : null;
            const taskSt = isCompleted ? 'completed' : (n.task_status ?? n.status);

            return (
              <div key={n.id} className="py-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left: Metadata & Descriptions */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-zinc-600 text-[10px] font-mono">
                        REF-{n.id ? n.id.slice(-6).toUpperCase() : '??????'}
                      </span>
                      {/* Urgency Score Badge */}
                      <UrgencyScoreBadge score={n.urgency_score} />
                      {/* Urgency Level */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${URGENCY_COLORS[displayUrgency] ?? URGENCY_COLORS.low}`}>
                        {displayUrgency}
                      </span>
                      {/* People affected */}
                      {(n.people_affected || n.headcount || n.estimated_people_affected) && (
                        <span className="text-zinc-400 text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                          ~{n.people_affected ?? n.headcount ?? n.estimated_people_affected} people
                        </span>
                      )}
                    </div>
                    <p className="text-white text-sm font-semibold break-words">{truncated}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {n.reporter_name || 'Anonymous'} · {n.location || 'Location not specified'}
                    </p>
                  </div>

                  {/* Right: Badges, Status, and Action Buttons (Clean wrap on mobile) */}
                  <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                    {/* Assigned volunteer */}
                    {assignedName && (
                      <span className="text-[#34D399] text-[10px] font-semibold bg-[#34D399]/10 border border-[#34D399]/20 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                        👤 {assignedName}
                      </span>
                    )}

                    {/* Task status badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${isCompleted ? TASK_PILL.completed : (TASK_PILL[taskSt] ?? TASK_PILL.open)}`}>
                      {isCompleted ? 'completed' : (taskSt ? taskSt.replace(/_/g, ' ') : 'open')}
                    </span>

                    {/* WhatsApp SOS share button */}
                    <a
                      href={getWhatsAppEmergencyUrl(n)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-[8px] text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                      title="Share emergency via WhatsApp"
                    >
                      <MessageCircle size={14} />
                    </a>

                    {/* Volunteer claim if open */}
                    {!isCompleted && n.status === 'open' && n.user_uid !== currentUser?.uid && (
                      <button
                        onClick={() => handleInterest(n.id)}
                        disabled={interestedMissions[`${currentUser?.uid}_${n.id}`] || (n.responding_volunteers && n.responding_volunteers.includes(currentUser?.uid)) || interestLoading[n.id]}
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] transition cursor-pointer ${
                          (interestedMissions[`${currentUser?.uid}_${n.id}`] || (n.responding_volunteers && n.responding_volunteers.includes(currentUser?.uid)))
                            ? 'bg-white/10 text-[#34D399] cursor-default'
                            : interestLoading[n.id]
                            ? 'bg-[#34D399]/50 text-[#09090B] cursor-wait'
                            : 'bg-[#34D399] text-[#09090B] hover:bg-[#10B981]'
                        }`}
                      >
                        {(interestedMissions[`${currentUser?.uid}_${n.id}`] || (n.responding_volunteers && n.responding_volunteers.includes(currentUser?.uid))) ? "On Your Way" : interestLoading[n.id] ? '…' : "I'm On My Way"}
                      </button>
                    )}

                    {/* Mark Resolved or Done Indicator */}
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check size={11} strokeWidth={3} /> Done
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolve(n.id)}
                        className="p-1.5 rounded-[8px] text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                        title="Mark Resolved / Complete"
                      >
                        <CheckSquare size={14} />
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => setDeletingId(isDeleting ? null : n.id)}
                      className="p-1.5 rounded-[8px] text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                      title="Permanently delete need"
                    >
                      {isDeleting ? <X size={13} /> : <Trash2 size={13} />}
                    </button>

                    {/* Timestamp */}
                    <span className="text-zinc-600 text-[10px] ml-1 flex-shrink-0">
                      {formatIST(n.created_at)}
                    </span>
                  </div>
                </div>

                {/* Inline delete confirmation prompt */}
                {isDeleting && (
                  <div className="mt-3 p-3 rounded-[12px] bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-red-400 text-xs">Permanently delete this emergency record and decrement stats?</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(n.id)}
                        disabled={deleteLoading}
                        className="px-3 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 transition disabled:opacity-50 cursor-pointer"
                      >
                        {deleteLoading ? 'Deleting…' : 'Confirm Delete'}
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="text-zinc-400 text-[10px] hover:text-white transition px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {toast && <Toast type={toast.type} message={toast.message} onDismiss={() => setToast(null)} />}
    </GlassCard>
  );
}

// ── Section C: User Role Manager (with search & mobile scroll) ─────────────
function UserRoleManager() {
  const { currentUser, roleLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [fetchState, setFetchState] = useState('loading');
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!currentUser || roleLoading) return;
    setFetchState('loading');
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users ?? []);
      setFetchState('done');
    } catch (err) {
      console.error(err);
      setFetchState('error');
    }
  }, [currentUser, roleLoading]);

  useEffect(() => {
    if (!currentUser || roleLoading) return;
    fetchUsers();
  }, [fetchUsers, currentUser, roleLoading]);

  const handleRoleChange = async (uid, newRole) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(uid)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      setToast({ type: 'success', message: 'Role updated successfully.' });
    } catch {
      setToast({ type: 'error', message: 'Failed to update role.' });
    }
  };

  const q = search.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter((u) => {
        const name = (u.displayName || u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : users;

  return (
    <GlassCard className="rounded-[24px] overflow-hidden">
      <div className="px-6 py-4 border-b border-white/6">
        <h2 className="text-white font-bold text-base">User Role Manager</h2>
        <p className="text-zinc-500 text-xs mt-0.5">Manage platform access levels.</p>
        <div className="relative mt-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search users by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[10px] text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>
      </div>
      <div className="overflow-x-auto w-full">
        <table className="w-full min-w-[500px] text-left border-collapse">
          <thead>
            <tr className="border-b border-white/6">
              {['Name', 'Email', 'Current Role', 'Actions'].map(h => (
                <th key={h} className="text-left px-6 py-3 text-zinc-500 text-[11px] uppercase tracking-widest font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fetchState === 'loading' && (
              <tr>
                <td colSpan="4" className="px-6 py-6">
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-10 rounded-[10px] bg-white/5 animate-pulse" />
                    ))}
                  </div>
                </td>
              </tr>
            )}

            {fetchState === 'error' && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-zinc-500 text-sm">
                  Failed to load users.
                  <button onClick={fetchUsers} className="ml-2 text-[#34D399] hover:underline">Retry</button>
                </td>
              </tr>
            )}

            {fetchState === 'done' && filteredUsers.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-zinc-500 text-sm">
                  {q ? 'No users match your search.' : 'No users found.'}
                </td>
              </tr>
            )}

            {fetchState === 'done' && filteredUsers.map((u, i) => (
              <tr key={u.uid} className={`border-b border-white/4 ${i === filteredUsers.length - 1 ? 'border-0' : ''}`}>
                <td className="px-6 py-4 text-white text-sm font-medium">{u.displayName || u.name || 'Unknown'}</td>
                <td className="px-6 py-4 text-zinc-400 text-sm">{u.email || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${URGENCY_COLORS[u.role] ?? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'}`}>
                    {u.role ?? 'unassigned'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <select value={u.role ?? ''} onChange={e => handleRoleChange(u.uid, e.target.value)}
                    className="bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[10px] px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#34D399]/50 transition appearance-none cursor-pointer">
                    <option className="bg-slate-900 text-white" value="" disabled>Select role</option>
                    <option className="bg-slate-900 text-white" value="requester">Requester</option>
                    <option className="bg-slate-900 text-white" value="volunteer">Volunteer</option>
                    <option className="bg-slate-900 text-white" value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast && <Toast type={toast.type} message={toast.message} onDismiss={() => setToast(null)} />}
    </GlassCard>
  );
}

// ── Main AdminDash ─────────────────────────────────────────────────────────
export default function AdminDash() {
  const { currentUser, roleLoading } = useAuth();
  const [apiStatus, setApiStatus] = useState('checking');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const triggerStatsRefresh = () => setStatsRefreshKey(k => k + 1);

  const isRoot = [
    '/admin-dash',
    '/admin-dash/',
    '/admin-dash/map',
    '/admin-dash/insights',
    '/admin-dash/settings',
    '/admin-dash/support',
  ].includes(location.pathname);
  
  const currentSub = location.pathname.split('/admin-dash/')[1] || '';
  const activeTab = currentSub === 'map' ? 'map' : currentSub === 'insights' ? 'insights' : (currentSub === 'settings' || currentSub === 'support') ? 'support' : 'overview';

  if (roleLoading || currentUser === undefined) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#34D399] border-t-transparent animate-spin" />
      </div>
    );
  }

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then(r => r.ok ? setApiStatus('online') : setApiStatus('offline'))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <div className="flex h-screen bg-[#09090B] overflow-hidden">
      <AdminSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* Mobile Header Bar (< md:) */}
        <div className="flex md:hidden items-center justify-between pb-4 mb-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-[#34D399] flex items-center justify-center flex-shrink-0">
              <span className="text-[#09090B] font-black text-xs">SR</span>
            </div>
            <span className="font-extrabold text-white text-sm tracking-tight">SmartRelief</span>
            <span className="text-[10px] font-semibold text-[#34D399] bg-[#34D399]/10 border border-[#34D399]/20 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white cursor-pointer"
            aria-label="Open mobile navigation menu"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Dashboard Title & Connection Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-[-0.05em]">Admin Dashboard</h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-1">Platform oversight, recent needs, and user management.</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border self-start sm:self-auto ${apiStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : apiStatus === 'offline' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-[#34D399] animate-pulse' : apiStatus === 'offline' ? 'bg-red-400' : 'bg-zinc-400'}`} />
            {apiStatus === 'online' ? 'API Connected' : apiStatus === 'offline' ? 'API Offline' : 'Checking...'}
          </span>
        </div>

        {/* Section A — Live Metrics (Auto synced with Recent Needs) */}
        <MetricsBar refreshKey={statsRefreshKey} />

        {isRoot ? (
          <>
            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-white/6 overflow-x-auto">
              <button
                onClick={() => navigate('/admin-dash')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'overview'
                    ? 'text-[#34D399] border-[#34D399]'
                    : 'text-zinc-500 border-transparent hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => navigate('/admin-dash/map')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'map'
                    ? 'text-[#34D399] border-[#34D399]'
                    : 'text-zinc-500 border-transparent hover:text-white'
                }`}
              >
                Live Map
              </button>
              <button
                onClick={() => navigate('/admin-dash/insights')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'insights'
                    ? 'text-[#34D399] border-[#34D399]'
                    : 'text-zinc-500 border-transparent hover:text-white'
                }`}
              >
                Platform Insights
              </button>
              <button
                onClick={() => navigate('/admin-dash/support')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'support'
                    ? 'text-[#34D399] border-[#34D399]'
                    : 'text-zinc-500 border-transparent hover:text-white'
                }`}
              >
                Settings & Support
              </button>
            </div>

            {/* Tab Content */}
            <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
              {/* Section B — Recent Needs */}
              <div className="grid grid-cols-12 gap-6 mb-6">
                <RecentNeeds onStatsRefresh={triggerStatsRefresh} />
              </div>

              {/* Section C — User Role Manager */}
              <UserRoleManager />
            </div>

            <div className={`h-[500px] sm:h-[600px] w-full ${activeTab === 'map' ? 'block' : 'hidden'}`}>
              <LiveMap isActive={activeTab === 'map'} />
            </div>

            {activeTab === 'insights' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GlassCard className="rounded-[24px] p-6">
                  <h3 className="text-white font-bold text-base mb-2">Automated Prioritization Insights</h3>
                  <p className="text-zinc-400 text-xs mb-4">
                    The Smart Prioritization engine blends severity weights (Critical: 100, High: 70, Medium: 40, Low: 10) with +25 keyword boosts and headcount bonuses.
                  </p>
                  <div className="space-y-3">
                    <div className="p-3 rounded-[14px] bg-white/5 flex items-center justify-between">
                      <span className="text-xs text-zinc-300">Target Response Latency</span>
                      <strong className="text-xs text-[#34D399]">&lt; 5 minutes</strong>
                    </div>
                    <div className="p-3 rounded-[14px] bg-white/5 flex items-center justify-between">
                      <span className="text-xs text-zinc-300">Geospatial Swarm Search Radius</span>
                      <strong className="text-xs text-sky-400">25 km Haversine</strong>
                    </div>
                    <div className="p-3 rounded-[14px] bg-white/5 flex items-center justify-between">
                      <span className="text-xs text-zinc-300">Vision OCR Model Stack</span>
                      <strong className="text-xs text-amber-400">Llama-3.2-90B + 11B NIM</strong>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="rounded-[24px] p-6">
                  <h3 className="text-white font-bold text-base mb-2">Emergency Response Operations</h3>
                  <p className="text-zinc-400 text-xs mb-4">
                    Real-time operational readiness across all registered volunteer clusters and field responders.
                  </p>
                  <div className="space-y-3">
                    <div className="p-3 rounded-[14px] bg-white/5 flex items-center justify-between">
                      <span className="text-xs text-zinc-300">Multi-Volunteer Atomic Team Lock</span>
                      <strong className="text-xs text-[#34D399]">Active ($expr guarded)</strong>
                    </div>
                    <div className="p-3 rounded-[14px] bg-white/5 flex items-center justify-between">
                      <span className="text-xs text-zinc-300">Real-Time Radar Polling</span>
                      <strong className="text-xs text-emerald-400">15s Frequency</strong>
                    </div>
                    <div className="p-3 rounded-[14px] bg-white/5 flex items-center justify-between">
                      <span className="text-xs text-zinc-300">Database Engine</span>
                      <strong className="text-xs text-purple-400">Motor Async MongoDB</strong>
                    </div>
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === 'support' && (
              <GlassCard className="rounded-[24px] p-6 max-w-2xl">
                <h3 className="text-white font-bold text-base mb-2">Incident Command & Helpdesk</h3>
                <p className="text-zinc-400 text-xs mb-6">
                  Need technical assistance or operational dispatch support? Contact our centralized response desk.
                </p>
                <div className="space-y-3 mb-6">
                  <div className="p-4 rounded-[16px] bg-white/5 border border-white/5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">National Emergency Services</p>
                    <p className="text-lg font-bold text-white mt-1">Dial 112 (Police / Fire / Medical)</p>
                  </div>
                  <div className="p-4 rounded-[16px] bg-white/5 border border-white/5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">National Disaster Helpline</p>
                    <p className="text-lg font-bold text-amber-400 mt-1">Dial 1078 (NDMA)</p>
                  </div>
                  <div className="p-4 rounded-[16px] bg-white/5 border border-white/5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">SmartRelief Ops Center</p>
                    <p className="text-sm font-semibold text-[#34D399] mt-1">ops@smartrelief.org</p>
                  </div>
                </div>
              </GlassCard>
            )}
          </>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
