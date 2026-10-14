import { Bell, ClipboardList, AlertTriangle, Users, Zap, Upload, FileText } from 'lucide-react';
import GlassCard from './GlassCard';

export default function DashboardContent() {
  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[rgba(255,255,255,0.06)]">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-[-0.05em]">Command Overview</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Real-time humanitarian resource status</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#34D399]/10 border border-[#34D399]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
            <span className="text-[#34D399] text-xs font-medium">Live</span>
          </div>
          <button className="w-9 h-9 rounded-[10px] bg-white/5 border border-white/8 flex items-center justify-center text-zinc-400 hover:text-white transition">
            <Bell size={15} />
          </button>
        </div>
      </div>

      {/* Content grid */}
      <div className="p-8 grid grid-cols-12 gap-5">
        {/* WIDGET 1 — Actionable Insights */}
        <div className="grid grid-cols-4 gap-5 col-span-12">
          {[
            { label: 'Total Active Needs', value: '3,291', delta: '+18 today', icon: ClipboardList, color: 'emerald' },
            { label: 'Urgent Requests', value: '142', delta: '↑ Critical priority', icon: AlertTriangle, color: 'red' },
            { label: 'Volunteers Available', value: '8,420', delta: '94 newly joined', icon: Users, color: 'blue' },
            { label: 'Matches This Week', value: '1,847', delta: '↑ 12% vs last week', icon: Zap, color: 'emerald' },
          ].map((s, i) => (
            <GlassCard key={i} className="rounded-[20px] p-5">
              <div className="flex items-start justify-between mb-4">
                <p className="text-zinc-400 text-xs font-medium">{s.label}</p>
                <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${
                  s.color === 'emerald' ? 'bg-[#34D399]/10 text-[#34D399]' :
                  s.color === 'red'     ? 'bg-red-500/10 text-red-400' :
                                          'bg-blue-500/10 text-blue-400'
                }`}>
                  <s.icon size={14} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-white tracking-[-0.05em] mb-1">{s.value}</p>
              <p className="text-[#34D399] text-xs font-medium">{s.delta}</p>
            </GlassCard>
          ))}
        </div>

        {/* WIDGET 2 — Smart Need Prioritization */}
        <GlassCard className="rounded-[24px] p-6 col-span-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-bold tracking-[-0.04em]">Smart Need Prioritization</h3>
              <p className="text-zinc-500 text-xs mt-0.5">AI-scored urgency queue</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-semibold">
              4 Critical
            </span>
          </div>

          {[
            { id: 'NGO-2841', title: 'Flood Relief – Sylhet', type: 'Disaster Response', score: 98, priority: 'critical' },
            { id: 'NGO-2839', title: 'Medical Aid – Nairobi East', type: 'Healthcare', score: 91, priority: 'high' },
            { id: 'NGO-2835', title: 'Food Distribution – Dhaka', type: 'Nutrition', score: 84, priority: 'high' },
            { id: 'NGO-2830', title: 'Literacy Drive – Lagos', type: 'Education', score: 67, priority: 'medium' },
          ].map((need, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white text-xs font-semibold truncate">{need.title}</p>
                </div>
                <p className="text-zinc-500 text-[10px]">{need.id} · {need.type}</p>
              </div>
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black border-2 ${
                  need.priority === 'critical' ? 'border-red-500 text-red-400 bg-red-500/10' :
                  need.priority === 'high'     ? 'border-orange-500 text-orange-400 bg-orange-500/10' :
                                                 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                }`}>
                  {need.score}
                </div>
                <p className="text-[9px] text-zinc-600 mt-0.5 capitalize">{need.priority}</p>
              </div>
            </div>
          ))}

          <button className="w-full mt-4 py-2.5 rounded-full border border-[rgba(255,255,255,0.08)] text-zinc-400 text-xs hover:border-[#34D399]/30 hover:text-[#34D399] transition">
            View Full Queue →
          </button>
        </GlassCard>

        {/* WIDGET 3 — Intelligent Volunteer Match (Bento) */}
        <GlassCard className="rounded-[24px] p-6 col-span-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-bold tracking-[-0.04em]">Intelligent Match</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Top volunteers for NGO-2841 · Flood Relief – Sylhet</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#34D399]/10 border border-[#34D399]/20 text-[#34D399] text-[11px] font-semibold">
              3 Recommended
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { name: 'Aisha N.', role: 'Emergency Nurse', skills: ['Medical Aid', 'Triage'], dist: '4.2km', match: '97%', avail: 'Available now' },
              { name: 'Rohan V.', role: 'Logistics Lead', skills: ['Supply Chain', 'Transport'], dist: '11km', match: '91%', avail: 'Available now' },
              { name: 'Clara M.', role: 'Field Coordinator', skills: ['Crisis Mgmt', 'Comms'], dist: '18km', match: '86%', avail: 'Avail. in 2h' },
            ].map((v, i) => (
              <div key={i} className={`p-4 rounded-[18px] border transition ${
                i === 0
                  ? 'bg-[#34D399]/8 border-[#34D399]/25'
                  : 'bg-white/4 border-[rgba(255,255,255,0.07)]'
              }`}>
                {i === 0 && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-[#34D399] text-[#09090B] text-[9px] font-black mb-2">
                    BEST MATCH
                  </span>
                )}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#34D399]/30 to-zinc-700/50 flex items-center justify-center text-white font-bold text-sm mb-3">
                  {v.name[0]}
                </div>
                <p className="text-white text-xs font-semibold">{v.name}</p>
                <p className="text-zinc-500 text-[10px] mb-2">{v.role}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {v.skills.map(s => (
                    <span key={s} className="px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-400 text-[9px]">{s}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-[10px]">📍 {v.dist}</span>
                  <span className="text-[#34D399] text-xs font-black">{v.match}</span>
                </div>
                <p className="text-zinc-600 text-[9px] mt-1">{v.avail}</p>
              </div>
            ))}
          </div>

          <button className="w-full py-2.5 rounded-full bg-[#34D399] text-[#09090B] text-xs font-bold hover:bg-[#10B981] transition">
            Deploy Top Match → Aisha N.
          </button>
        </GlassCard>

        {/* WIDGET 4 — Offline-to-Digital Upload */}
        <GlassCard className="rounded-[24px] p-6 col-span-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-[12px] bg-[#34D399]/10 flex items-center justify-center text-[#34D399]">
              <Upload size={18} />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-[-0.04em]">Offline-to-Digital</h3>
              <p className="text-zinc-500 text-[11px]">Convert paper forms to structured data</p>
            </div>
          </div>

          <div className="border-2 border-dashed border-[rgba(255,255,255,0.10)] rounded-[16px] p-6 flex flex-col items-center justify-center text-center mb-4 hover:border-[#34D399]/30 transition cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 text-zinc-500">
              <Upload size={20} />
            </div>
            <p className="text-zinc-300 text-xs font-semibold mb-1">Drop field forms here</p>
            <p className="text-zinc-600 text-[10px]">PDF, JPG, PNG · Max 20MB</p>
          </div>

          <button className="w-full py-2.5 rounded-full bg-white/5 border border-[rgba(255,255,255,0.08)] text-zinc-300 text-xs font-semibold hover:bg-white/10 transition flex items-center justify-center gap-2">
            <Upload size={13} />
            Upload Form Data
          </button>

          <div className="mt-4 space-y-2">
            <p className="text-zinc-600 text-[10px] uppercase tracking-widest">Recent Uploads</p>
            {[
              { name: 'field_report_dhaka_06.pdf', status: 'Processed', time: '2m ago' },
              { name: 'needs_assessment_lagos.jpg', status: 'Processing', time: '8m ago' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                <FileText size={12} className="text-zinc-500 flex-shrink-0" />
                <p className="text-zinc-400 text-[10px] flex-1 truncate">{f.name}</p>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  f.status === 'Processed'
                    ? 'bg-[#34D399]/10 text-[#34D399]'
                    : 'bg-yellow-500/10 text-yellow-400'
                }`}>{f.status}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* WIDGET 5 — Live Map Placeholder */}
        <GlassCard className="rounded-[24px] overflow-hidden col-span-8 relative flex flex-col" style={{ minHeight: '280px' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950">
            <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
            {[
              { top: '30%', left: '25%', label: 'Dhaka', urgent: true },
              { top: '55%', left: '48%', label: 'Nairobi', urgent: true },
              { top: '40%', left: '68%', label: 'Sylhet', urgent: false },
              { top: '65%', left: '30%', label: 'Lagos', urgent: false },
            ].map((pin, i) => (
              <div key={i} className="absolute flex flex-col items-center" style={{ top: pin.top, left: pin.left }}>
                <div className={`w-3 h-3 rounded-full border-2 ${pin.urgent ? 'bg-red-500 border-red-300 animate-ping absolute' : 'bg-[#34D399] border-[#34D399]/50'}`} />
                <div className={`w-3 h-3 rounded-full ${pin.urgent ? 'bg-red-500' : 'bg-[#34D399]'} relative z-10`} />
                <span className="text-[9px] text-white/60 mt-1 whitespace-nowrap">{pin.label}</span>
              </div>
            ))}
          </div>
          <div className="relative z-10 p-5 flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold tracking-[-0.04em] text-sm">Live Need Map</h3>
              <p className="text-zinc-500 text-[11px]">Real-time deployment view · 4 active zones</p>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500"/>Critical</span>
              <span className="flex items-center gap-1.5 text-[#34D399]"><span className="w-2 h-2 rounded-full bg-[#34D399]"/>Active</span>
            </div>
          </div>
          <div className="absolute bottom-4 right-4 z-10">
            <button className="px-4 py-2 rounded-full bg-black/50 border border-white/10 text-zinc-300 text-xs backdrop-blur-sm hover:bg-black/70 transition">
              Open Full Map →
            </button>
          </div>
        </GlassCard>

      </div>
    </div>
  );
}
