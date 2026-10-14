import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import UrgencyScoreBadge from '../components/UrgencyScoreBadge';
import AdminSidebar from '../components/AdminSidebar';
import { API_BASE_URL } from '../config/api';

const URGENCY_COLOR = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

function NeedCard({ need }) {
  const urgency = (need.urgency ?? 'low').toLowerCase();
  const refId = need.id ? need.id.slice(-6).toUpperCase() : '??????';
  const isCompleted = need.status === 'completed' || need.status === 'resolved';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[16px] bg-white/3 border border-[rgba(255,255,255,0.05)] hover:border-white/10 transition">
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-zinc-600 text-[10px] font-mono">REF-{refId}</span>
          <UrgencyScoreBadge score={need.urgency_score} />
          {urgency in URGENCY_COLOR && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${URGENCY_COLOR[urgency]}`}>
              {urgency}
            </span>
          )}
        </div>
        <p className="text-white text-sm font-semibold break-words">
          {need.needs_description ?? 'Untitled Need'}
        </p>
        <p className="text-zinc-500 text-xs mt-0.5">{need.location ?? '—'}</p>
      </div>
      <div className="flex-shrink-0 text-left sm:text-right w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1">
        {isCompleted ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
            <CheckCircle2 size={11} /> Completed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/20 text-[10px] font-semibold">
            <AlertTriangle size={11} /> Active
          </span>
        )}
        {need.responding_volunteers?.length > 0 && (
          <p className="text-zinc-500 text-[10px]">
            {(need.volunteers_needed ?? 1) > 1
              ? `${(need.assigned_volunteers ?? []).length} / ${need.volunteers_needed} assigned`
              : `${need.responding_volunteers.length} volunteer(s)`}
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, items, emptyText, accentClass }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Icon size={16} className={accentClass} />
        <h2 className="text-white font-bold text-base">{title}</h2>
        <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/5 text-zinc-400 text-[10px] font-bold">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center rounded-[16px] bg-white/3 border border-[rgba(255,255,255,0.05)]">
          <p className="text-zinc-500 text-sm">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(need => <NeedCard key={need.id} need={need} />)}
        </div>
      )}
    </div>
  );
}

export default function AdminPriorities() {
  const { currentUser, roleLoading } = useAuth();
  const [allNeeds, setAllNeeds] = useState([]);
  const [fetchState, setFetchState] = useState('loading');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchNeeds = useCallback(async () => {
    if (!currentUser) return;
    setFetchState('loading');
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/needs?limit=200&sort=created_at&status=all`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllNeeds(data.needs ?? []);
      setFetchState('done');
    } catch (err) {
      console.error('[AdminPriorities] Fetch failed:', err);
      setFetchState('error');
    }
  }, [currentUser]);

  useEffect(() => {
    if (roleLoading || !currentUser?.uid) return;
    fetchNeeds();
  }, [fetchNeeds, roleLoading, currentUser?.uid]);

  const score = n => n.urgency_score ?? 0;
  const pending   = allNeeds.filter(n => n.status !== 'completed' && n.status !== 'resolved').sort((a, b) => score(b) - score(a));
  const completed = allNeeds.filter(n => n.status === 'completed' || n.status === 'resolved').sort((a, b) => score(b) - score(a));

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
              Priorities
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
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-[-0.05em]">Priorities</h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-1">Needs ranked mathematically by verified urgency score.</p>
          </div>
          <button onClick={fetchNeeds}
            className="flex items-center gap-1.5 border border-white/8 text-zinc-400 text-xs px-4 py-2 rounded-full hover:text-white transition self-start sm:self-auto cursor-pointer">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {fetchState === 'loading' && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 rounded-[16px] bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {fetchState === 'error' && (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-sm mb-3">Failed to load priority needs.</p>
            <button onClick={fetchNeeds}
              className="text-xs text-[#34D399] hover:underline">
              Retry
            </button>
          </div>
        )}

        {fetchState === 'done' && (
          <div className="space-y-8">
            <Section
              title="Active Priorities"
              icon={AlertTriangle}
              items={pending}
              emptyText="No active needs — all clear!"
              accentClass="text-[#34D399]"
            />
            <Section
              title="Resolved"
              icon={CheckCircle2}
              items={completed}
              emptyText="No completed needs yet."
              accentClass="text-zinc-500"
            />
          </div>
        )}
      </main>
    </div>
  );
}
