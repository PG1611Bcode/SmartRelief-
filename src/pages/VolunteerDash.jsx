import { useCallback, useEffect, useState, useRef } from 'react';
import {
  CheckSquare, RefreshCw, Zap, Mail, Menu, MessageCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import VolunteerSidebar from '../components/VolunteerSidebar';
import { useLocation, Link } from 'react-router-dom';
import { useInterest } from '../hooks/useInterest';
import LiveMap from '../components/LiveMap';
import UrgencyScoreBadge from '../components/UrgencyScoreBadge';
import { API_BASE_URL } from '../config/api';
import { getWhatsAppEmergencyUrl } from '../utils/whatsapp';

// ── Styling constants ────────────────────────────────────────────────────────
const URGENCY_PILL = {
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
  high:     'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  medium:   'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  low:      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

const STATUS_PILL = {
  'in_progress':      'bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/20',
  'pending_briefing': 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  'completed':        'bg-zinc-700/30 text-zinc-400 border border-zinc-600/20',
  'open':             'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'filled':           'bg-orange-500/10 text-orange-400 border border-orange-500/20',
};

const STATUS_LABELS = {
  in_progress: 'In Progress',
  pending_briefing: 'Pending Briefing',
  completed: 'Completed',
  open: 'Open',
  filled: 'Team Full',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Render requester identity block — used inside both card types. */
function RequesterBlock({ requester, contact_email, reporter_name }) {
  // Prefer enriched requester obj; fall back to legacy flat fields on the doc.
  const name  = requester?.name  || reporter_name  || 'Anonymous Requester';
  const email = requester?.email || contact_email  || '';

  return (
    <div className="mt-2.5 pt-2.5 border-t border-white/5">
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

// ── Skeletons ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return <div className="h-[76px] rounded-[16px] bg-white/5 animate-pulse" />;
}

function SkeletonCard() {
  return <div className="h-52 rounded-[20px] bg-white/5 animate-pulse" />;
}

// ── Global auth-loading spinner ───────────────────────────────────────────────
function AuthSpinner() {
  return (
    <div className="flex h-screen bg-[#09090B] items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#34D399] border-t-transparent animate-spin" />
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function VolunteerDash() {
  const { currentUser, roleLoading } = useAuth();
  const [bannerToast, setBannerToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isMapTab = location.pathname === '/volunteer-dash/map';
  const isSupportTab = location.pathname === '/volunteer-dash/support';

  // ── Active assignments (server-authoritative: /api/needs/my-active) ───────
  const [tasks, setTasks] = useState([]);
  const [tasksState, setTasksState] = useState('loading');

  // ── Open missions ─────────────────────────────────────────────────────────
  const [missions, setMissions] = useState([]);
  const [missionsState, setMissionsState] = useState('loading');
  const [expandedMissions, setExpandedMissions] = useState({});

  // ── Geospatial & Skills Radar State ───────────────────────────────────────
  const [userCoords, setUserCoords] = useState(() => {
    const cachedLat = localStorage.getItem('volunteer_lat');
    const cachedLng = localStorage.getItem('volunteer_lng');
    if (cachedLat && cachedLng) {
      return { lat: parseFloat(cachedLat), lng: parseFloat(cachedLng) };
    }
    return { lat: 19.2812, lng: 72.8561 }; // Default fallback Mira Bhayandar
  });
  const [userLocationName, setUserLocationName] = useState(() => {
    return localStorage.getItem('volunteer_location') || localStorage.getItem('volunteer_location_name') || '';
  });
  const [userSkills, setUserSkills] = useState(() => {
    const cachedSkills = localStorage.getItem('volunteer_skills');
    if (cachedSkills) {
      try {
        const parsed = JSON.parse(cachedSkills);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'recommended'

  // Prioritize saved profile coordinates & skills (Firestore + localStorage) FIRST.
  // ONLY fall back to laptop browser geolocation if user has no saved profile coordinates.
  useEffect(() => {
    let hasCoords = false;

    // 1. Check localStorage for immediate synchronous values
    const localLat = localStorage.getItem('volunteer_lat');
    const localLng = localStorage.getItem('volunteer_lng');
    const localLoc = localStorage.getItem('volunteer_location') || localStorage.getItem('volunteer_location_name');
    const localSkillsStr = localStorage.getItem('volunteer_skills');

    if (localLat && localLng) {
      setUserCoords({ lat: parseFloat(localLat), lng: parseFloat(localLng) });
      hasCoords = true;
    }
    if (localLoc) {
      setUserLocationName(localLoc);
    }
    if (localSkillsStr) {
      try {
        const parsed = JSON.parse(localSkillsStr);
        if (Array.isArray(parsed) && parsed.length > 0) setUserSkills(parsed);
      } catch {}
    }

    // 2. Fetch authoritative Firestore profile
    if (currentUser?.uid) {
      getDoc(doc(db, 'users', currentUser.uid))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const profLat = data.lat ?? data.latitude;
            const profLng = data.lng ?? data.longitude;
            const profLoc = data.location ?? data.location_name;
            const profSkills = data.skills;

            if (profLat != null && profLng != null) {
              setUserCoords({ lat: parseFloat(profLat), lng: parseFloat(profLng) });
              hasCoords = true;
              localStorage.setItem('volunteer_lat', String(profLat));
              localStorage.setItem('volunteer_lng', String(profLng));
            }
            if (profLoc) {
              setUserLocationName(profLoc);
              localStorage.setItem('volunteer_location', profLoc);
            }
            if (Array.isArray(profSkills) && profSkills.length > 0) {
              setUserSkills(profSkills);
              localStorage.setItem('volunteer_skills', JSON.stringify(profSkills));
            }

            // Fallback to browser geolocation ONLY if no saved profile coordinates exist
            if (!hasCoords && profLat == null) {
              initBrowserGeolocation();
            }
          } else if (!hasCoords) {
            initBrowserGeolocation();
          }
        })
        .catch((err) => {
          console.warn('[VolunteerDash] Profile fetch error:', err);
          if (!hasCoords) initBrowserGeolocation();
        });
    } else if (!hasCoords) {
      initBrowserGeolocation();
    }

    function initBrowserGeolocation() {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setUserLocationName('Browser GPS');
          },
          (err) => {
            console.warn('[VolunteerDash] Geolocation fallback used:', err.message);
            setUserCoords({ lat: 19.2812, lng: 72.8561 });
            setUserLocationName('Mira Bhayandar (Anchor)');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }
  }, [currentUser?.uid]);

  // ── Polling for new needs (useRef to avoid re-renders) ───────────────────
  const knownNeedIdsRef = useRef(new Set());

  // When I'm On My Way succeeds: update mission with server-confirmed doc.
  // Only remove from open missions if the team is now full (status === 'filled').
  const handleInterestSuccess = useCallback((needId, updatedNeed) => {
    if (updatedNeed) {
      const isFilled = updatedNeed.status === 'filled';
      if (isFilled) {
        // Team is full — remove from open missions, add to active tasks
        setMissions((prev) => prev.filter((m) => m.id !== needId));
      } else {
        // Team still has slots — update the mission card in-place so the
        // capacity badge reflects the new count.
        setMissions((prev) =>
          prev.map((m) => (m.id === needId ? { ...m, ...updatedNeed } : m)),
        );
      }
      setTasks((prev) => {
        if (prev.some((t) => t.id === updatedNeed.id)) {
          return prev.map((t) => (t.id === updatedNeed.id ? updatedNeed : t));
        }
        return [updatedNeed, ...prev];
      });
    } else {
      // No updated doc returned — remove optimistically
      setMissions((prev) => prev.filter((m) => m.id !== needId));
    }
  }, []);



  // ── Fetch active assignments ───────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!currentUser || roleLoading) return;
    setTasksState('loading');
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/needs/my-active`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-User-UID': currentUser.uid,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTasks((data.needs ?? []).filter((n) => n.status !== 'completed' && n.status !== 'resolved'));
      setTasksState('done');
    } catch (err) {
      console.error('[VolunteerDash] Active assignments fetch failed:', err);
      setTasksState('error');
    }
  }, [currentUser, roleLoading]);

  // ── Fetch open missions (with Geolocation & Skill Radar) ───────────────────
  const fetchMissions = useCallback(async () => {
    if (!currentUser || roleLoading) return;
    setMissionsState('loading');
    try {
      const idToken = await currentUser.getIdToken();
      const params = new URLSearchParams({
        status: 'open,filled',
        limit: '50',
        sort: 'created_at',
      });
      if (userCoords?.lat != null && userCoords?.lng != null) {
        params.set('lat', String(userCoords.lat));
        params.set('lng', String(userCoords.lng));
      }
      if (userSkills && userSkills.length > 0) {
        params.set('skills', userSkills.join(','));
      }

      const res = await fetch(
        `${API_BASE_URL}/api/needs?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
            'X-User-UID': currentUser.uid,
          },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMissions(
        (data.needs ?? [])
          .filter((n) => n.status !== 'completed' && n.status !== 'resolved')
          .slice()
          .sort((a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0))
      );
      setMissionsState('done');
    } catch (err) {
      console.error('[VolunteerDash] Missions fetch failed:', err);
      setMissionsState('error');
    }
  }, [currentUser, roleLoading, userCoords, userSkills]);

  // Aliases for clear domain semantics
  const fetchNeeds = fetchMissions;
  const fetchActiveAssignments = fetchTasks;

  // Force re-fetch both feeds so UI reflects true DB state after any claim.
  const refetchAll = useCallback(() => {
    fetchTasks();
    fetchMissions();
  }, [fetchTasks, fetchMissions]);

  const { interestLoading, interestedMissions, handleInterest, clearInterest } = useInterest(
    currentUser, setBannerToast, handleInterestSuccess, refetchAll,
  );

  // Auth-race fix: defer all fetches until both Firebase Auth and Firestore
  // role are resolved.  Effect re-fires on currentUser transition.
  useEffect(() => {
    if (!currentUser || roleLoading) return;
    fetchTasks();
    fetchMissions();
  }, [fetchTasks, fetchMissions, currentUser, roleLoading]);

  // Background poll every 30 s.
  useEffect(() => {
    if (!currentUser || roleLoading) return;
    const id = setInterval(() => { fetchTasks(); fetchMissions(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchTasks, fetchMissions, currentUser, roleLoading]);

  // ── Polling for new needs (15s interval) ───────────────────────────────────
  useEffect(() => {
    if (!currentUser || roleLoading) return;

    const pollForNewNeeds = async () => {
      try {
        const idToken = await currentUser.getIdToken();
        const params = new URLSearchParams({
          status: 'open,filled',
          limit: '50',
          sort: 'created_at',
        });
        if (userCoords?.lat != null && userCoords?.lng != null) {
          params.set('lat', String(userCoords.lat));
          params.set('lng', String(userCoords.lng));
        }
        if (userSkills && userSkills.length > 0) {
          params.set('skills', userSkills.join(','));
        }
        const res = await fetch(
          `${API_BASE_URL}/api/needs?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
              'X-User-UID': currentUser.uid,
            },
          },
        );

        if (!res.ok) return;
        const data = await res.json();
        const currentNeeds = data.needs ?? [];

        // Compare against known IDs
        const currentIds = new Set(currentNeeds.map((n) => n.id));
        const newIds = [...currentIds].filter((id) => !knownNeedIdsRef.current.has(id));

        // Trigger toast for each new need
        newIds.forEach((id) => {
          const need = currentNeeds.find((n) => n.id === id);
          if (need) {
            toast(`🚨 Urgent Need Reported: ${need.location ?? 'Unknown Location'}`, {
              icon: '🚨',
              style: {
                background: '#18181B',
                color: '#FAFAFA',
                border: '1px solid rgba(255,255,255,0.10)',
              },
            });
          }
        });

        // Update ref with current IDs
        knownNeedIdsRef.current = currentIds;
      } catch (err) {
        console.error('[VolunteerDash] Polling failed:', err);
      }
    };

    // Initial population of known IDs (don't trigger toasts on mount)
    const initializeKnownIds = async () => {
      try {
        const idToken = await currentUser.getIdToken();
        const res = await fetch(
          `${API_BASE_URL}/api/needs?status=open&limit=50&sort=created_at`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
              'X-User-UID': currentUser.uid,
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          knownNeedIdsRef.current = new Set((data.needs ?? []).map((n) => n.id));
        }
      } catch (err) {
        console.error('[VolunteerDash] Initial ID fetch failed:', err);
      }
    };

    initializeKnownIds();

    const intervalId = setInterval(pollForNewNeeds, 15_000);
    return () => clearInterval(intervalId);
  }, [currentUser, roleLoading, userCoords, userSkills]);

  const handleResolveTask = async (taskId) => {
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
      await Promise.all([fetchNeeds(), fetchActiveAssignments()]);
      toast.success('🎉 Mission completed and marked as resolved!');
    } catch (err) {
      console.error('[VolunteerDash] Resolve task failed:', err);
      toast.error('Failed to resolve task.');
    }
  };

  const handleWithdrawTask = async (taskId) => {
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
      clearInterest?.(taskId);
      await Promise.all([fetchNeeds(), fetchActiveAssignments()]);
      toast.success('Withdrawn from team.');
    } catch (err) {
      console.error('[VolunteerDash] Withdraw failed:', err);
      toast.error('Failed to withdraw from team.');
    }
  };

  const toggleExpand = (id) =>
    setExpandedMissions((prev) => ({ ...prev, [id]: !prev[id] }));

  // Global spinner while Firebase/Firestore resolves.
  if (roleLoading || currentUser === undefined) return <AuthSpinner />;

  const availableMissions = missions.filter(
    (m) => !tasks.some((t) => t.id === m.id)
  );

  const recommendedCount = availableMissions.filter((m) => m.is_recommended).length;

  const displayMissions = availableMissions
    .filter((m) => (filterTab === 'recommended' ? m.is_recommended : true))
    .slice()
    .sort((a, b) => {
      if (filterTab === 'recommended') {
        return (b.match_score ?? 0) - (a.match_score ?? 0) || (b.urgency_score ?? 0) - (a.urgency_score ?? 0);
      }
      return (b.urgency_score ?? 0) - (a.urgency_score ?? 0);
    });

  // ── Render ────────────────────────────────────────────────────────────────
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
              Volunteer
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

        <div className={isMapTab || isSupportTab ? 'hidden' : 'block'}>
          {/* Greeting */}
          {/* Greeting & Active Radar Anchor Indicator */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-[-0.05em]">
                Welcome back, {currentUser?.displayName ?? 'Volunteer'}.
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Here are your active assignments and available missions.
              </p>
            </div>

            {/* Subtle Active Radar Anchor Indicator */}
            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2 w-fit shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
              <span>
                📍 Radar centered at:{' '}
                <strong className="text-zinc-200">
                  {userLocationName || `${userCoords.lat.toFixed(2)}, ${userCoords.lng.toFixed(2)}`}
                </strong>
              </span>
              <Link
                to="/volunteer-dash/profile"
                className="text-[#34D399] hover:underline font-semibold ml-1 transition"
              >
                Change in Profile
              </Link>
            </div>
          </div>

        {/* ── Active Assignments ─────────────────────────────────────────── */}
        <GlassCard className="rounded-[24px] p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-bold text-base">My Active Assignments</h2>
              {tasksState === 'done' && (
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/5 text-zinc-400 text-[10px] font-bold">
                  {tasks.length}
                </span>
              )}
            </div>
            <button onClick={fetchTasks} className="text-zinc-600 hover:text-zinc-300 transition">
              <RefreshCw size={14} />
            </button>
          </div>

          {tasksState === 'loading' && (
            <div className="space-y-3">
              {[1, 2].map((i) => <SkeletonRow key={i} />)}
            </div>
          )}

          {tasksState === 'error' && (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm mb-3">Could not load assignments.</p>
              <button onClick={fetchTasks}
                className="inline-flex items-center gap-1.5 text-zinc-400 text-xs border border-[rgba(255,255,255,0.08)] px-4 py-2 rounded-full hover:text-white transition">
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          )}

          {tasksState === 'done' && tasks.length === 0 && (
            <div className="text-center py-10 flex flex-col items-center">
              <CheckSquare size={28} className="text-zinc-700 mb-3" />
              <p className="text-zinc-400 text-sm font-medium">No active assignments yet.</p>
              <p className="text-zinc-600 text-xs mt-1">
                Say "I'm On My Way" to a mission below to get started.
              </p>
            </div>
          )}

          {tasksState === 'done' && tasks.length > 0 && (
            <div className="space-y-3">
              {tasks.map((t) => {
                const urgencyKey = (t.urgency ?? 'low').toLowerCase();
                const statusKey = (t.task_status ?? t.status ?? 'open').toLowerCase().replace(/ /g, '_');
                const currentCount = t.assigned_volunteers ? t.assigned_volunteers.length : 0;
                const needed = t.volunteers_needed || 1;
                return (
                  <div key={t.id} className="flex items-start gap-4 p-4 rounded-[16px] bg-white/3 border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.10)] transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-zinc-600 text-[10px] font-mono">
                          {t.id.slice(-8).toUpperCase()}
                        </span>
                        {urgencyKey in URGENCY_PILL && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${URGENCY_PILL[urgencyKey]}`}>
                            {urgencyKey}
                          </span>
                        )}
                        <UrgencyScoreBadge score={t.urgency_score} />
                        <span className="text-zinc-400 text-[11px] font-medium flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                          👥 Volunteers: {currentCount} / {needed} joined
                        </span>
                      </div>
                      <p className="text-white text-sm font-semibold break-words">
                        {t.needs_description ?? 'Untitled Task'}
                      </p>
                      <p className="text-zinc-500 text-xs mt-0.5">{t.location ?? '—'}</p>
                      {/* Requester identity block */}
                      <RequesterBlock
                        requester={t.requester}
                        contact_email={t.contact_email}
                        reporter_name={t.reporter_name}
                      />
                    </div>
                    <div className="flex-shrink-0 mt-1 flex flex-col items-end gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${STATUS_PILL[statusKey] ?? 'bg-zinc-700/30 text-zinc-400 border border-zinc-600/20'}`}>
                        {STATUS_LABELS[statusKey] ?? statusKey}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <a
                          href={getWhatsAppEmergencyUrl(t)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-full text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/10 transition cursor-pointer"
                          title="Share emergency via WhatsApp"
                        >
                          <MessageCircle size={12} />
                        </a>
                        <button
                          onClick={() => handleResolveTask(t.id)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#34D399] text-[#09090B] hover:bg-[#10B981] transition flex items-center gap-1 cursor-pointer"
                          title="Mark this mission as complete/resolved"
                        >
                          <CheckSquare size={11} /> Mark Resolved
                        </button>
                        <button
                          onClick={() => handleWithdrawTask(t.id)}
                          className="px-2 py-1 rounded-full text-[10px] font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 transition cursor-pointer"
                          title="Leave this volunteer team"
                        >
                          Leave Team
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* ── Open Missions ──────────────────────────────────────────────── */}
        <GlassCard className="rounded-[24px] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-white font-bold text-base">Open Missions Near You</h2>
              <p className="text-zinc-500 text-xs mt-1">Click "I'm On My Way" to respond to a need.</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Filter Toggle */}
              <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-full p-1 text-xs">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-[#34D399] text-[#09090B]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  All Urgent Missions ({availableMissions.length})
                </button>
                <button
                  onClick={() => setFilterTab('recommended')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    filterTab === 'recommended'
                      ? 'bg-[#34D399] text-[#09090B]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ✨ Recommended for Me ({recommendedCount})
                </button>
              </div>
              <button onClick={fetchMissions} className="text-zinc-600 hover:text-zinc-300 transition p-1.5 rounded-full hover:bg-white/5">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {missionsState === 'loading' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {missionsState === 'error' && (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm mb-3">Could not load open missions.</p>
              <button onClick={fetchMissions}
                className="inline-flex items-center gap-1.5 text-zinc-400 text-xs border border-[rgba(255,255,255,0.08)] px-4 py-2 rounded-full hover:text-white transition">
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          )}

          {missionsState === 'done' && displayMissions.length === 0 && (
            <div className="text-center py-10 flex flex-col items-center">
              <Zap size={28} className="text-zinc-700 mb-3" />
              <p className="text-zinc-400 text-sm font-medium">
                {filterTab === 'recommended' ? 'No recommended missions right now.' : 'No open missions right now.'}
              </p>
              <p className="text-zinc-600 text-xs mt-1">
                {filterTab === 'recommended'
                  ? 'Switch to "All Urgent Missions" or check back as new crisis needs are reported.'
                  : 'Check back soon — new needs are submitted daily.'}
              </p>
            </div>
          )}

          {missionsState === 'done' && displayMissions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayMissions.map((m) => {
                const urgencyKey = (m.urgency ?? 'low').toLowerCase();
                const refId = m.id ? m.id.slice(-6).toUpperCase() : '??????';
                const isExpanded = expandedMissions[m.id];
                const desc = m.needs_description ?? 'Untitled Need';
                const isLong = desc.length > 70;
                const isInterested = Boolean(
                  currentUser?.uid && m.assigned_volunteers?.includes(currentUser.uid)
                );
                const isLoadingInterest = interestLoading[m.id];
                const isOwned =
                  (currentUser?.uid && m.user_uid === currentUser?.uid) ||
                  (currentUser?.email && m.contact_email === currentUser?.email);

                // Team capacity
                const currentCount = m.assigned_volunteers ? m.assigned_volunteers.length : 0;
                const needed = m.volunteers_needed || 1;
                const isFilled = m.status === 'filled' || currentCount >= needed;

                return (
                  <GlassCard key={m.id} className="rounded-[20px] p-5 flex flex-col gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {urgencyKey in URGENCY_PILL && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${URGENCY_PILL[urgencyKey]}`}>
                              {urgencyKey}
                            </span>
                          )}
                          <UrgencyScoreBadge score={m.urgency_score} />
                          {m.distance_km != null && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                              📍 {m.distance_km} km away
                            </span>
                          )}
                          {m.is_recommended && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              ✨ Recommended for You
                            </span>
                          )}
                        </div>
                        <span className="text-zinc-600 text-[10px] font-mono">REF-{refId}</span>
                      </div>
                      <div className="mt-2 text-white text-sm font-semibold">
                        {isExpanded ? desc : `${desc.slice(0, 70)}${isLong ? '…' : ''}`}
                        {isLong && (
                          <button
                            onClick={() => toggleExpand(m.id)}
                            className="text-[#34D399] ml-1 text-xs hover:underline cursor-pointer"
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                      <p className="text-zinc-500 text-xs mt-1">{m.location ?? '—'}</p>
                      {m.matched_skills && m.matched_skills.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1.5">
                          <span className="text-[10px] text-zinc-400 font-medium">Matched:</span>
                          {m.matched_skills.map((skill, sIdx) => (
                            <span key={sIdx} className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.estimated_people_affected && (
                        <p className="text-zinc-500 text-xs mt-1">
                          ~{m.estimated_people_affected.toLocaleString()} people affected
                        </p>
                      )}
                      {/* Requester identity block */}
                      <RequesterBlock
                        requester={m.requester}
                        contact_email={m.contact_email}
                        reporter_name={m.reporter_name}
                      />
                    </div>

                    {/* Team capacity indicator directly above action button */}
                    <div className="mt-auto pt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[11px] font-medium flex items-center gap-1 text-zinc-400">
                          👥 Volunteers: <strong className="text-zinc-200">{currentCount} / {needed}</strong> joined
                        </span>
                        {isFilled && (
                          <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                            Team Full
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isFilled ? 'bg-orange-400' : 'bg-[#34D399]'
                          }`}
                          style={{ width: `${Math.min(100, (currentCount / needed) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-auto">
                      <a
                        href={getWhatsAppEmergencyUrl(m)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 text-zinc-400 transition flex items-center justify-center shrink-0 cursor-pointer"
                        title="Share emergency via WhatsApp"
                      >
                        <MessageCircle size={15} />
                      </a>
                      {isOwned ? (
                        <span className="inline-block px-2.5 py-2.5 text-center rounded-full bg-[#34D399] text-[#09090B] text-[10px] font-bold w-full">
                          ⭐ Your Request
                        </span>
                      ) : isFilled && !isInterested ? (
                        <span className="inline-block px-2.5 py-2.5 text-center rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-bold w-full">
                          Team Full
                        </span>
                      ) : (
                        <button
                          onClick={() => handleInterest(m.id)}
                          disabled={isInterested || isLoadingInterest || isFilled}
                          className={`w-full py-2.5 rounded-full font-bold text-xs transition ${
                            isInterested
                              ? 'bg-white/10 text-[#34D399] cursor-default'
                              : isLoadingInterest
                              ? 'bg-[#34D399]/50 text-[#09090B] cursor-wait'
                              : isFilled
                              ? 'bg-zinc-700/30 text-zinc-500 cursor-not-allowed'
                              : 'bg-[#34D399] text-[#09090B] hover:bg-[#10B981] cursor-pointer'
                          }`}
                        >
                          {isInterested ? "You're On Your Way" : isLoadingInterest ? 'Sending...' : "I'm On My Way"}
                        </button>
                      )}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </GlassCard>
        </div>

        {isMapTab && (
          <div className="h-[600px] w-full">
            <LiveMap isActive={isMapTab} />
          </div>
        )}

        {isSupportTab && (
          <GlassCard className="rounded-[24px] p-6 max-w-2xl">
            <h2 className="text-white font-bold text-lg mb-2">Volunteer Responder Support & Dispatch</h2>
            <p className="text-zinc-400 text-xs mb-6">
              Guidelines, emergency contacts, and dispatch coordination for registered field volunteers.
            </p>
            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-[16px] bg-white/5 border border-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Field Emergency SOS</p>
                <p className="text-xl font-bold text-red-400 mt-1">Dial 112</p>
                <p className="text-xs text-zinc-500 mt-1">Direct police, ambulance, and disaster rescue switchboard</p>
              </div>
              <div className="p-4 rounded-[16px] bg-white/5 border border-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Disaster Management Cell</p>
                <p className="text-xl font-bold text-amber-400 mt-1">Dial 1078</p>
                <p className="text-xs text-zinc-500 mt-1">State and National Disaster Response Forces</p>
              </div>
              <div className="p-4 rounded-[16px] bg-white/5 border border-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Volunteer Operations Desk</p>
                <p className="text-base font-semibold text-[#34D399] mt-1">ops@smartrelief.org</p>
                <p className="text-xs text-zinc-500 mt-1">Real-time team reassignments, equipment requests, and safe withdrawal</p>
              </div>
            </div>
          </GlassCard>
        )}
      </main>

      {bannerToast && <Toast type={bannerToast.type} message={bannerToast.message} onDismiss={() => setBannerToast(null)} />}
    </div>
  );
}
