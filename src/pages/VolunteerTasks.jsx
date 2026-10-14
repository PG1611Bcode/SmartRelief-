import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, RefreshCw, Zap, ClipboardList, Menu, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import VolunteerSidebar from '../components/VolunteerSidebar';
import UrgencyScoreBadge from '../components/UrgencyScoreBadge';
import { API_BASE_URL } from '../config/api';
import { getWhatsAppEmergencyUrl } from '../utils/whatsapp';

// ── Styling constants ─────────────────────────────────────────────────────────
const URGENCY_PILL = {
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
  high:     'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  medium:   'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  low:      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

const STATUS_PILL = {
  open:             'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  in_progress:      'bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/20',
  pending_briefing: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  completed:        'bg-zinc-700/30 text-zinc-400 border border-zinc-600/20',
  resolved:         'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  matched:          'bg-purple-500/10 text-purple-400 border border-purple-500/20',
};

const STATUS_LABELS = {
  open:             'Open',
  in_progress:      'In Progress',
  pending_briefing: 'Pending Briefing',
  completed:        'Completed',
  resolved:         'Resolved',
  matched:          'Matched',
};

function SkeletonRow() {
  return <div className="h-[68px] rounded-[16px] bg-white/5 animate-pulse" />;
}

function AuthSpinner() {
  return (
    <div className="flex h-screen bg-[#09090B] items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#34D399] border-t-transparent animate-spin" />
    </div>
  );
}

/** Consistent requester identity block used on every need card/row. */
function RequesterBlock({ requester, contact_email, reporter_name }) {
  const name  = requester?.name  || reporter_name  || 'Anonymous Requester';
  const email = requester?.email || contact_email  || '';
  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <p className="text-zinc-300 text-xs font-semibold truncate">{name}</p>
      {email ? (
        <a
          href={`mailto:${email}`}
          className="text-zinc-500 text-[10px] hover:text-[#34D399] transition truncate block mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {email}
        </a>
      ) : (
        <p className="text-zinc-700 text-[10px] mt-0.5">No contact on file</p>
      )}
    </div>
  );
}

function NeedRow({ need, onResolve, onWithdraw }) {
  const urgencyKey = (need.urgency ?? 'low').toLowerCase();
  const statusKey = (need.task_status ?? need.status ?? 'open').toLowerCase().replace(/ /g, '_');
  const refId = need.id ? need.id.slice(-8).toUpperCase() : '????????';
  const currentCount = need.assigned_volunteers ? need.assigned_volunteers.length : 0;
  const needed = need.volunteers_needed || 1;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[16px] bg-white/3 border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.10)] transition">
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-zinc-600 text-[10px] font-mono">REF-{refId}</span>
          <UrgencyScoreBadge score={need.urgency_score} />
          {urgencyKey in URGENCY_PILL && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${URGENCY_PILL[urgencyKey]}`}>
              {urgencyKey}
            </span>
          )}
          <span className="text-zinc-400 text-[11px] font-medium flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
            👥 Volunteers: {currentCount} / {needed} joined
          </span>
        </div>
        <p className="text-white text-sm font-semibold break-words">
          {need.needs_description ?? 'Untitled Need'}
        </p>
        <p className="text-zinc-500 text-xs mt-0.5">{need.location ?? '—'}</p>
        <RequesterBlock
          requester={need.requester}
          contact_email={need.contact_email}
          reporter_name={need.reporter_name}
        />
      </div>
      <div className="flex-shrink-0 mt-1 sm:mt-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${STATUS_PILL[statusKey] ?? 'bg-zinc-700/30 text-zinc-400 border border-zinc-600/20'}`}>
          {STATUS_LABELS[statusKey] ?? statusKey}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <a
            href={getWhatsAppEmergencyUrl(need)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-full text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/10 transition cursor-pointer"
            title="Share emergency via WhatsApp"
          >
            <MessageCircle size={12} />
          </a>
          {onResolve && (
            <>
              <button
                onClick={() => onResolve(need.id)}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#34D399] text-[#09090B] hover:bg-[#10B981] transition flex items-center gap-1 cursor-pointer"
                title="Mark this mission as complete/resolved"
              >
                <CheckSquare size={11} /> Mark Resolved
              </button>
              <button
                onClick={() => onWithdraw(need.id)}
                className="px-2 py-1 rounded-full text-[10px] font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 transition cursor-pointer"
                title="Leave this volunteer team"
              >
                Leave Team
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VolunteerTasks() {
  const { currentUser, roleLoading } = useAuth();
  const navigate = useNavigate();
  const [needs, setNeeds] = useState([]);
  const [fetchState, setFetchState] = useState('loading');
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchMyTasks = useCallback(async () => {
    if (!currentUser) return;
    setFetchState('loading');
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/needs/my-tasks`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-User-UID': currentUser.uid,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNeeds(data.needs ?? []);
      setFetchState('done');
    } catch (err) {
      console.error('[VolunteerTasks] fetch error:', err);
      setFetchState('error');
    }
  }, [currentUser]);

  useEffect(() => {
    if (roleLoading || !currentUser?.uid) return;
    fetchMyTasks();
  }, [fetchMyTasks, roleLoading, currentUser?.uid]);

  const activeTasks = needs.filter((n) => n.status !== 'completed' && n.status !== 'resolved');
  const completedTasks = needs.filter((n) => n.status === 'completed' || n.status === 'resolved');

  const handleResolve = async (taskId) => {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/needs/${taskId}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-User-UID': currentUser.uid,
        },
      });
      if (!res.ok) throw new Error('Resolve failed');
      setToast({ type: 'success', message: 'Mission marked as resolved!' });
      fetchMyTasks();
    } catch (err) {
      console.error('[VolunteerTasks] Resolve failed:', err);
      setToast({ type: 'error', message: 'Failed to resolve mission.' });
    }
  };

  const handleWithdraw = async (taskId) => {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/needs/${taskId}/withdraw`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-User-UID': currentUser.uid,
        },
      });
      if (!res.ok) throw new Error('Withdraw failed');
      setToast({ type: 'success', message: 'Withdrawn from team.' });
      fetchMyTasks();
    } catch (err) {
      console.error('[VolunteerTasks] Withdraw failed:', err);
      setToast({ type: 'error', message: 'Failed to withdraw.' });
    }
  };

  if (roleLoading || currentUser === undefined) return <AuthSpinner />;

  return (
    <div className="flex h-screen bg-[#09090B] overflow-hidden">
      <VolunteerSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* Mobile Header Bar (< md:) */}
        <div className="flex md:hidden items-center justify-between pb-4 mb-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-[#34D399] flex items-center justify-center flex-shrink-0">
              <span className="text-[#09090B] font-black text-xs">SR</span>
            </div>
            <span className="font-extrabold text-white text-sm tracking-tight">SmartRelief</span>
            <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
              Tasks
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

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-[-0.05em]">My Tasks</h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-1">
              Needs you've committed to or completed.
            </p>
          </div>
          <button
            onClick={fetchMyTasks}
            className="flex items-center gap-1.5 border border-white/8 text-zinc-400 text-xs px-4 py-2 rounded-full hover:text-white transition self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {fetchState === 'loading' && (
          <div className="space-y-4">
            <div className="h-5 w-32 rounded-[6px] bg-white/5 animate-pulse mb-3" />
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {fetchState === 'error' && (
          <div className="text-center py-16 flex flex-col items-center">
            <ClipboardList size={32} className="text-zinc-700 mb-3" />
            <p className="text-zinc-400 text-sm font-medium mb-1">Could not load your tasks.</p>
            <p className="text-zinc-600 text-xs mb-4">Check your connection and try again.</p>
            <button
              onClick={fetchMyTasks}
              className="inline-flex items-center gap-1.5 text-zinc-400 text-xs border border-[rgba(255,255,255,0.08)] px-4 py-2 rounded-full hover:text-white transition cursor-pointer"
            >
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        )}

        {fetchState === 'done' && (
          <>
            {/* ── Active Tasks ─────────────────────────────────────────────── */}
            <GlassCard className="rounded-[24px] p-4 sm:p-6 mb-6">
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-white font-bold text-base">Active Tasks</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/5 text-zinc-400 text-[10px] font-bold">
                  {activeTasks.length}
                </span>
              </div>

              {activeTasks.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center">
                  <Zap size={26} className="text-zinc-700 mb-3" />
                  <p className="text-zinc-400 text-sm font-medium">No active tasks.</p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Head to{' '}
                    <button
                      onClick={() => navigate('/volunteer-dash')}
                      className="text-[#34D399] hover:underline cursor-pointer"
                    >
                      Open Missions
                    </button>{' '}
                    and say "I'm On My Way" to pick up a need.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeTasks.map((n) => (
                    <NeedRow
                      key={n.id}
                      need={n}
                      onResolve={handleResolve}
                      onWithdraw={handleWithdraw}
                    />
                  ))}
                </div>
              )}
            </GlassCard>

            {/* ── Completed Tasks ───────────────────────────────────────────── */}
            <GlassCard className="rounded-[24px] p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-white font-bold text-base">Completed</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/5 text-zinc-400 text-[10px] font-bold">
                  {completedTasks.length}
                </span>
              </div>

              {completedTasks.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center">
                  <CheckSquare size={26} className="text-zinc-700 mb-3" />
                  <p className="text-zinc-400 text-sm font-medium">No completions yet.</p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Completed needs appear here once the requester confirms.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((n) => <NeedRow key={n.id} need={n} />)}
                </div>
              )}
            </GlassCard>
          </>
        )}
      </main>

      {toast && <Toast type={toast.type} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
