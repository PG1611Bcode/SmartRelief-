import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Target, Zap } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import GrainOverlay from '../components/GrainOverlay';

export default function Hero({ openSignup }) {
  return (
    <section className="relative overflow-hidden min-h-[92vh] rounded-[40px] bg-gradient-to-b from-[#09090B] via-[#09090B] to-[#0f1a14] flex items-center">
      <GrainOverlay />
      
      {/* Background Abstract Glow Orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full bg-[#34D399]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-200px] w-[500px] h-[500px] rounded-full bg-white/3 blur-[100px] pointer-events-none" />
      
      {/* Massive Background Text */}
      <span className="absolute inset-0 flex items-center justify-center text-[18vw] font-black text-white/[0.03] select-none pointer-events-none tracking-[-0.05em] whitespace-nowrap">
        IMPACT
      </span>

      <div className="relative z-20 w-full px-12 py-24 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* LEFT COLUMN */}
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-[rgba(255,255,255,0.10)] text-[#34D399] text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
            Live Matching Active
          </div>
          
          <h1 className="text-[clamp(3rem,7vw,6rem)] font-extrabold tracking-[-0.05em] leading-[0.95] text-white mb-6">
            Connect.<br/>
            <span className="text-[#34D399]">Impact.</span><br/>
            Match.
          </h1>
          
          <p className="text-[#A1A1AA] text-xl leading-relaxed max-w-md mb-8">
            SmartMatch uses real-time needs analysis and volunteer bridging to route the right people
            to the right mission — automatically, at scale.
          </p>
          
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/signup" className="bg-[#34D399] text-[#09090B] font-bold px-8 py-4 rounded-full hover:bg-[#10B981] transition text-base inline-block">
              Start Volunteering
            </Link>
            <button className="text-white/70 hover:text-white flex items-center gap-2 transition">
              <span className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">▶</span>
              See How It Works
            </button>
          </div>
          
          <p className="mt-6 text-sm text-[#A1A1AA]">
            Trusted by <span className="text-white font-semibold">240+ NGOs</span> across 38 countries.
          </p>
        </div>

        {/* RIGHT COLUMN */}
        <div className="relative flex flex-col gap-4">
          <div className="rotate-[1deg]">
            <GlassCard className="p-6 rounded-[24px] min-w-[280px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#A1A1AA] text-sm font-medium">Live Volunteers</span>
                <div className="w-8 h-8 rounded-[12px] bg-[#34D399]/10 flex items-center justify-center text-[#34D399]">
                  <Users size={16} />
                </div>
              </div>
              <div className="text-4xl font-extrabold tracking-[-0.05em] text-white mb-1">12,847</div>
              <div className="text-[#34D399] text-xs font-medium">+143 joined today</div>
            </GlassCard>
          </div>
          <div className="-rotate-[0.5deg] -mt-2">
             <GlassCard className="p-6 rounded-[24px] min-w-[280px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#A1A1AA] text-sm font-medium">Active Needs</span>
                <div className="w-8 h-8 rounded-[12px] bg-[#34D399]/10 flex items-center justify-center text-[#34D399]">
                  <Target size={16} />
                </div>
              </div>
              <div className="text-4xl font-extrabold tracking-[-0.05em] text-white mb-1">3,291</div>
              <div className="flex items-center justify-between gap-4 mt-2">
                <div className="text-[#34D399] text-xs font-medium">91 newly posted</div>
                <div className="flex-1 max-w-[100px] h-1.5 rounded-full bg-white/10">
                  <div className="h-1.5 rounded-full bg-[#34D399] w-[67%]" />
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="rotate-[1.5deg]">
            <GlassCard className="p-6 rounded-[24px] min-w-[280px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#A1A1AA] text-sm font-medium">Successful Matches</span>
                <div className="w-8 h-8 rounded-[12px] bg-[#34D399]/10 flex items-center justify-center text-[#34D399]">
                  <Zap size={16} />
                </div>
              </div>
              <div className="text-4xl font-extrabold tracking-[-0.05em] text-white mb-1">98,402</div>
              <div className="text-[#34D399] text-xs font-medium">This month: 7,891</div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  );
}
