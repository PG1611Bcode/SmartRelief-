import React from 'react';
import { MapPin, Brain, Users, BarChart2, Shield, Zap } from 'lucide-react';

export default function Features() {
  const features = [
    { icon: MapPin, title: "Geo-Based Routing", body: "Match volunteers within optimal radius of active needs." },
    { icon: Brain, title: "AI Needs Analysis", body: "Auto-classify incoming requests by urgency, type, and resource requirement." },
    { icon: Users, title: "Volunteer Profiles", body: "Skills, availability, and cause-alignment — all scored and searchable." },
    { icon: BarChart2, title: "Impact Metrics", body: "Real-time dashboards showing coverage, response time, and deployment rates." },
    { icon: Shield, title: "Verified Partners", body: "NGO onboarding with compliance verification and trust scoring." },
    { icon: Zap, title: "Instant Bridging", body: "Sub-60-second volunteer-to-need connections via smart notification routing." }
  ];

  return (
    <section id="features" className="bg-[#F4F4F5] py-32 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
        
        {/* LEFT */}
        <div>
          <div className="sticky top-28 self-start">
            <span className="text-[#34D399] text-sm font-semibold uppercase tracking-widest">Platform Capabilities</span>
            <h2 className="text-5xl font-extrabold tracking-[-0.05em] text-[#09090B] leading-tight mt-3 mb-6">
              Everything your<br/>
              <span className="text-[#34D399]">mission needs.</span>
            </h2>
            <p className="text-[#52525B] text-lg leading-relaxed max-w-sm">
              From volunteer intake to field deployment, SmartMatch's needs analysis engine
              handles every step of the matching pipeline.
            </p>
            
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature, i) => (
                <div key={i} className="p-5 bg-white rounded-[20px] border border-[#E4E4E7] hover:border-[#34D399]/40 hover:shadow-md transition group">
                  <div className="w-10 h-10 rounded-[12px] bg-[#F4F4F5] flex items-center justify-center text-[#34D399] mb-3 group-hover:bg-[#34D399]/10 transition">
                    <feature.icon size={18} />
                  </div>
                  <h4 className="font-semibold text-[#09090B] text-sm mb-1">{feature.title}</h4>
                  <p className="text-[#71717A] text-xs leading-relaxed">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="relative">
          <div className="sticky top-28 self-start">
            <div className="bg-[#09090B] rounded-[32px] p-6 border border-[rgba(255,255,255,0.08)] shadow-[0_40px_80px_rgba(0,0,0,0.25)]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-white/30 font-mono">SmartMatch · System Analysis</span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">Active Match Queue</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#34D399]/15 text-[#34D399] text-xs font-medium">Live</span>
              </div>

              {[
                { name: "Aisha N.", skill: "Medical Aid", need: "Field Triage · Nairobi", score: "97%" },
                { name: "Rohan V.", skill: "Logistics", need: "Supply Chain · Mumbai", score: "91%" },
                { name: "Clara M.", skill: "Education", need: "Literacy Drive · Lagos", score: "88%" },
                { name: "James T.", skill: "Construction", need: "Shelter Build · Dhaka", score: "84%" },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#34D399]/30 to-[#34D399]/10 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold">{row.name}</p>
                    <p className="text-[#71717A] text-xs truncate">{row.skill}</p>
                  </div>
                  <div className="text-center w-24">
                    <p className="text-[#A1A1AA] text-[10px] truncate">{row.need}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#34D399] text-xs font-bold">{row.score}</span>
                  </div>
                </div>
              ))}

              <div className="mt-5 p-4 rounded-[16px] bg-white/5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#A1A1AA]">Queue match rate</span>
                  <span className="text-[#34D399] font-semibold">94.2%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div className="h-1.5 rounded-full bg-[#34D399] w-[94%]" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
