import { useEffect, useState, useCallback } from 'react';
import { Check, ClipboardList, RefreshCw, Trash2, X, MessageCircle } from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import { API_BASE_URL } from '../config/api';
import { getWhatsAppEmergencyUrl } from '../utils/whatsapp';

// ── Step timeline helpers ─────────────────────────────────────────────────────

function buildSteps(need) {
  const hasAiScore = need.ai_score != null;
  const isCompleted = need.status === 'completed';

  return [
    {
      label: 'Need Broadcasted',
      detail: need.created_at
        ? `Sent to volunteers at ${new Date(need.created_at).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit',
            year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
          })}`
        : 'Broadcasting to volunteer swarm',
      state: 'done',
    },
    {
      label: 'AI Priority Scored',
      detail: hasAiScore
        ? `Urgency: ${(need.computed_urgency ?? need.urgency ?? '').charAt(0).toUpperCase() + (need.computed_urgency ?? need.urgency ?? '').slice(1)} (Score ${need.ai_score})`
        : 'Awaiting AI scoring…',
      state: hasAiScore ? 'done' : 'active',
    },
    {
      label: 'Volunteers Responding',
      detail: isCompleted
        ? 'Volunteers arrived and assisted.'
        : (need.responding_volunteers?.length > 0)
          ? `${need.responding_volunteers.length} volunteer(s) on their way`
          : 'Waiting for volunteers…',
      state: isCompleted ? 'done' : hasAiScore ? 'active' : 'pending',
    },
    {
      label: 'Handshake Complete',
      detail: isCompleted
        ? 'Completion confirmed.'
        : 'Awaiting your confirmation once help arrives.',
      state: isCompleted ? 'done' : 'pending',
    },
  ];
}

function StepCircle({ state }) {
  if (state === 'done') {
    return (
      <div className="w-8 h-8 rounded-full bg-[#34D399] flex items-center justify-center flex-shrink-0">
        <Check size={14} className="text-[#09090B]" strokeWidth={3} />
      </div>
    );
  }
  if (state === 'active') {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-[#34D399] flex items-center justify-center flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-[#34D399] animate-pulse" />
      </div>
    );
  }
  return <div className="w-8 h-8 rounded-full border-2 border-[rgba(255,255,255,0.12)] bg-transparent flex-shrink-0" />;
}

function ConnectorLine() {
  return <div className="ml-[15px] w-px h-8 bg-gradient-to-b from-[#34D399]/40 to-transparent" />;
}

// ── Handshake volunteers panel ────────────────────────────────────────────────

function HandshakeVolunteers({ needId, onCompleted }) {
  const [interests, setInterests] = useState([]);
  const [panelState, setPanelState] = useState('loading');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchInterests = useCallback(async () => {
    setPanelState('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/interests?need_id=${encodeURIComponent(needId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInterests(data.interests ?? []);
      setPanelState('done');
    } catch {
      setPanelState('error');
    }
  }, [needId]);

  useEffect(() => { fetchInterests(); }, [fetchInterests]);

  const toggleVol = (uid) => {
    const next = new Set(selected);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    setSelected(next);
    setErrorMsg('');
  };

  const handleComplete = async () => {
    if (selected.size === 0) { setErrorMsg('Select at least one volunteer.'); return; }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers = { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) };
      const volUids = Array.from(selected);

      const patchRes = await fetch(`${API_BASE_URL}/api/needs/${needId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ status: 'completed', completed_by: volUids }),
      });
      if (!patchRes.ok) throw new Error(`PATCH HTTP ${patchRes.status}`);

      const compRes = await fetch(`${API_BASE_URL}/api/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({ need_id: needId, volunteer_uids: volUids }),
      });
      if (!compRes.ok) throw new Error(`POST HTTP ${compRes.status}`);

      setModalOpen(false);
      onCompleted(needId);
    } catch (err) {
      console.error('[Handshake] Failed:', err);
      setErrorMsg('Failed to confirm completion. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (panelState === 'loading' || panelState === 'error' || interests.length === 0) return null;

  return (
    <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.06)]">
      {!modalOpen ? (
        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-3 rounded-[12px] bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/20 font-bold text-sm hover:bg-[#34D399]/20 transition flex justify-center items-center gap-2"
        >
          <Check size={16} /> Mark Complete
        </button>
      ) : (
        <div className="p-5 rounded-[16px] bg-zinc-900 border border-white/10">
          <h3 className="text-white font-bold text-base mb-1">Confirm Completion</h3>
          <p className="text-zinc-400 text-xs mb-4">Select volunteers who assisted with this need.</p>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-4 pr-2">
            {interests.map(v => (
              <label key={v.id} className="flex items-center gap-3 p-3 rounded-[12px] bg-white/5 border border-[rgba(255,255,255,0.08)] cursor-pointer hover:border-white/20 transition">
                <input type="checkbox" className="accent-[#34D399] w-4 h-4 cursor-pointer"
                  checked={selected.has(v.volunteer_uid)} onChange={() => toggleVol(v.volunteer_uid)} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{v.volunteer_display_name || 'Volunteer'}</p>
                  {v.volunteer_email && <p className="text-zinc-500 text-[10px] truncate">{v.volunteer_email}</p>}
                </div>
              </label>
            ))}
          </div>
          {errorMsg && <p className="text-red-400 text-xs mb-3">{errorMsg}</p>}
          <div className="flex items-center gap-2">
            <button onClick={handleComplete} disabled={submitting}
              className="flex-1 py-2.5 rounded-full bg-[#34D399] text-[#09090B] font-bold text-sm hover:bg-[#10B981] transition disabled:opacity-50">
              {submitting ? 'Completing…' : 'Confirm & Complete'}
            </button>
            <button onClick={() => { setModalOpen(false); setErrorMsg(''); }} disabled={submitting}
              className="px-5 py-2.5 rounded-full border border-white/10 text-white font-bold text-sm hover:bg-white/5 transition disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel, loading }) {
  return (
    <div className="mt-4 p-4 rounded-[14px] bg-red-500/8 border border-red-500/20 flex flex-col gap-3">
      <p className="text-red-400 text-xs font-semibold">
        Delete this request? This cannot be undone.
      </p>
      <div className="flex items-center gap-2">
        <button onClick={onConfirm} disabled={loading}
          className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition disabled:opacity-50 cursor-pointer">
          {loading ? 'Deleting…' : 'Yes, Delete'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-1.5 rounded-full border border-[rgba(255,255,255,0.1)] text-zinc-400 text-xs font-semibold hover:text-white transition cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminMyRequests() {
  const { currentUser, roleLoading } = useAuth();

  const [needs, setNeeds] = useState([]);
  const [fetchState, setFetchState] = useState('loading');
  const [deletingId, setDeletingId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchNeeds = useCallback(async () => {
    if (!currentUser?.uid) return;
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(
        `${API_BASE_URL}/api/needs?limit=50&sort=created_at&user_uid=${currentUser.uid}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
            'X-User-UID': currentUser.uid,
          },
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setNeeds(data.needs ?? []);
      setFetchState('done');
    } catch (err) {
      console.error('[AdminMyRequests] Fetch failed:', err);
      setFetchState(prev => prev === 'done' ? 'done' : 'error');
    }
  }, [currentUser]);

  useEffect(() => {
    if (roleLoading || !currentUser?.uid) return;
    setFetchState('loading');
    fetchNeeds();
  }, [fetchNeeds, roleLoading, currentUser?.uid]);

  useEffect(() => {
    if (roleLoading || !currentUser?.uid) return;
    const id = setInterval(fetchNeeds, 15_000);
    return () => clearInterval(id);
  }, [fetchNeeds, roleLoading, currentUser?.uid]);

  const handleCompleted = needId =>
    setNeeds(prev => prev.map(n => n.id === needId ? { ...n, status: 'completed' } : n));

  const handleDelete = async (needId) => {
    setDeleteLoading(true);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/needs/${needId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-User-UID': currentUser.uid,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      setNeeds(prev => prev.filter(n => n.id !== needId));
      setDeletingId(null);
    } catch (err) {
      console.error('[AdminMyRequests] Delete failed:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-[-0.05em]">My Requests</h1>
          <p className="text-zinc-500 text-sm mt-1">Track needs you&apos;ve submitted as an admin.</p>
        </div>
        <button onClick={fetchNeeds}
          className="flex items-center gap-1.5 border border-white/8 text-zinc-400 text-xs px-4 py-2 rounded-full hover:text-white transition">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      <div className="max-w-2xl space-y-4">
        {fetchState === 'loading' && (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-48 rounded-[32px] bg-white/5 animate-pulse" />)}
          </div>
        )}

        {fetchState === 'error' && (
          <div className="text-center py-12">
            <p className="text-zinc-400 text-sm mb-4">Failed to load. Please check your connection.</p>
            <button onClick={fetchNeeds}
              className="inline-flex items-center gap-2 border border-[rgba(255,255,255,0.08)] text-zinc-400 text-xs px-5 py-2.5 rounded-full hover:text-white hover:border-white/20 transition">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {fetchState === 'done' && needs.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center">
            <div className="w-16 h-16 rounded-[20px] bg-zinc-800/60 border border-[rgba(255,255,255,0.06)] flex items-center justify-center mb-5">
              <ClipboardList size={28} className="text-zinc-600" />
            </div>
            <p className="text-white font-semibold text-base mb-1">No requests found.</p>
            <p className="text-zinc-500 text-xs">Needs submitted by you will appear here.</p>
          </div>
        )}

        {fetchState === 'done' && needs.map(need => {
          const steps = buildSteps(need);
          const refId = need.id ? need.id.slice(-6).toUpperCase() : '??????';
          const isDeleting = deletingId === need.id;

          return (
            <GlassCard key={need.id} className="rounded-[32px] p-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="text-white text-xl font-bold">
                    {need.needs_description
                      ? need.needs_description.slice(0, 60) + (need.needs_description.length > 60 ? '…' : '')
                      : 'Untitled Need'}
                  </h2>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-zinc-800/60 border border-[rgba(255,255,255,0.08)] text-zinc-400 text-xs font-mono">
                      REF-{refId}
                    </span>
                    {need.location && <span className="text-zinc-500 text-xs">{need.location}</span>}
                    {need.urgency && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        need.urgency === 'critical' ? 'bg-red-500/15 text-red-400' :
                        need.urgency === 'high'     ? 'bg-orange-500/15 text-orange-400' :
                        need.urgency === 'medium'   ? 'bg-yellow-500/15 text-yellow-400' :
                                                      'bg-emerald-500/15 text-emerald-400'
                      }`}>{need.urgency}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a
                    href={getWhatsAppEmergencyUrl(need)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-[10px] text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                    title="Share request via WhatsApp"
                  >
                    <MessageCircle size={15} />
                  </a>
                  <button
                    onClick={() => setDeletingId(isDeleting ? null : need.id)}
                    className="p-2 rounded-[10px] text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    title="Delete request"
                  >
                    {isDeleting ? <X size={15} /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>

              {isDeleting && (
                <DeleteConfirm
                  onConfirm={() => handleDelete(need.id)}
                  onCancel={() => setDeletingId(null)}
                  loading={deleteLoading}
                />
              )}

              {/* Timeline */}
              <div className="mt-2">
                {steps.map((step, i) => (
                  <div key={step.label}>
                    <div className="flex items-start gap-4">
                      <StepCircle state={step.state} />
                      <div className="flex-1 pb-1">
                        <p className={`text-sm font-semibold ${step.state === 'pending' ? 'text-zinc-500' : 'text-white'}`}>
                          {step.label}
                        </p>
                        <p className={`text-xs mt-0.5 ${step.state === 'active' ? 'text-[#34D399]' : 'text-zinc-600'}`}>
                          {step.detail}
                        </p>
                      </div>
                    </div>
                    {i < steps.length - 1 && <ConnectorLine />}
                  </div>
                ))}
              </div>

              {/* Handshake */}
              {need.status === 'completed' ? (
                <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.06)] flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#34D399]/20 text-[#34D399] font-bold text-sm">
                    <Check size={16} /> Completed
                  </span>
                </div>
              ) : (
                <HandshakeVolunteers needId={need.id} onCompleted={handleCompleted} />
              )}
            </GlassCard>
          );
        })}

        {fetchState === 'done' && needs.length > 0 && (
          <p className="text-zinc-700 text-xs text-center pt-2">End of requests.</p>
        )}
      </div>
    </div>
  );
}
