import { useCallback, useEffect, useState } from 'react';
import {
  Users, Search, RefreshCw, MapPin, Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import AdminSidebar from '../components/AdminSidebar';
import { API_BASE_URL } from '../config/api';

export default function AdminVolunteers() {
  const { currentUser, roleLoading } = useAuth();
  const [volunteers, setVolunteers] = useState([]);
  const [fetchState, setFetchState] = useState('loading');
  const [search, setSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchVolunteers = useCallback(async () => {
    if (!currentUser) return;
    setFetchState('loading');
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const volUsers = (data.users ?? []).filter((u) => u.role === 'volunteer' || u.is_volunteer);
      setVolunteers(volUsers);
      setFetchState('done');
    } catch (err) {
      console.error('[AdminVolunteers] Fetch failed:', err);
      setFetchState('error');
    }
  }, [currentUser]);

  useEffect(() => {
    if (roleLoading || !currentUser?.uid) return;
    fetchVolunteers();
  }, [fetchVolunteers, roleLoading, currentUser?.uid]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? volunteers.filter((v) => {
        const name = (v.displayName || v.name || '').toLowerCase();
        const email = (v.email || '').toLowerCase();
        const loc = (v.location || '').toLowerCase();
        return name.includes(q) || email.includes(q) || loc.includes(q);
      })
    : volunteers;

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
              Volunteers
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-[-0.05em]">Volunteers</h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-1">Registered volunteer response pool.</p>
          </div>
          <button onClick={fetchVolunteers}
            className="flex items-center gap-1.5 border border-white/8 text-zinc-400 text-xs px-4 py-2 rounded-full hover:text-white transition self-start sm:self-auto cursor-pointer">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {/* Glass Card Table with Mobile Scroll */}
        <GlassCard className="rounded-[24px] overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search volunteers by name, email, or city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[10px] text-white text-xs placeholder-zinc-600 focus:outline-none focus:border-[#34D399]/50 transition"
              />
            </div>
            <span className="text-zinc-500 text-xs self-end sm:self-center">
              {filtered.length} {filtered.length === 1 ? 'volunteer' : 'volunteers'}
            </span>
          </div>

          {fetchState === 'loading' && (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-[12px] bg-white/5 animate-pulse" />
              ))}
            </div>
          )}

          {fetchState === 'error' && (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm mb-3">Failed to load volunteers.</p>
              <button onClick={fetchVolunteers} className="text-xs text-[#34D399] hover:underline">
                Retry
              </button>
            </div>
          )}

          {fetchState === 'done' && filtered.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-zinc-800/60 flex items-center justify-center mb-3 text-zinc-600">
                <Users size={22} />
              </div>
              <p className="text-zinc-400 text-sm font-medium">
                {q ? 'No volunteers match your search.' : 'No volunteers registered yet.'}
              </p>
              <p className="text-zinc-600 text-xs mt-1">
                {q ? 'Try a different search term.' : 'Volunteers will appear here once registered.'}
              </p>
            </div>
          )}

          {/* Table with overflow-x-auto */}
          {fetchState === 'done' && filtered.length > 0 && (
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[500px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/6">
                    {['Volunteer', 'Email', 'Location'].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-zinc-500 text-[11px] uppercase tracking-widest font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => {
                    const name = v.displayName || v.name || 'Unknown';
                    return (
                      <tr key={v.uid} className={`border-b border-white/4 hover:bg-white/2 transition ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">
                              {name[0]?.toUpperCase() ?? 'V'}
                            </div>
                            <span className="text-white text-sm font-semibold">{name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-400 text-sm">{v.email || '—'}</td>
                        <td className="px-6 py-4">
                          {v.location ? (
                            <span className="inline-flex items-center gap-1 text-zinc-400 text-xs">
                              <MapPin size={10} className="text-zinc-600" />{v.location}
                            </span>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </main>
    </div>
  );
}
