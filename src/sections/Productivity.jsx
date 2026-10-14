import React from 'react';
import GrainOverlay from '../components/GrainOverlay';

export default function Productivity() {
  const steps = [
    { num: '01', title: 'Create Your Profile', desc: 'Set your skills, availability, languages, and cause preferences. Our algorithm starts learning immediately.' },
    { num: '02', title: 'Needs Analysis Engine', desc: 'SmartMatch scans 1,200+ active humanitarian briefs and scores them against your profile in real time.' },
    { num: '03', title: 'Receive Your Match', desc: 'Get notified with your top 3 matched needs — ranked by impact potential, proximity, and urgency.' },
    { num: '04', title: 'Bridge & Deploy', desc: 'Accept a match, connect with the NGO coordinator, and begin making measurable impact.' }
  ];

  return (
    <section id="how-it-works" className="relative overflow-hidden bg-[#18181B] py-32 px-6">
      <GrainOverlay />
      
      <div className="relative z-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        {/* LEFT */}
        <div>
          <span className="text-[#34D399] text-sm font-semibold uppercase tracking-widest">How It Works</span>
          <h2 className="text-5xl font-extrabold tracking-[-0.05em] text-white leading-tight mt-3 mb-10">
            From sign-up<br/>
            to <span className="text-[#34D399]">deployed</span><br/>
            in minutes.
          </h2>

          <div className="flex flex-col">
            {steps.map((step, i) => (
              <div key={i} className="relative flex gap-5 pb-10 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-[12px] bg-[#34D399]/10 border border-[#34D399]/30 flex items-center justify-center text-[#34D399] text-xs font-bold flex-shrink-0">
                    {step.num}
                  </div>
                  {i !== steps.length - 1 && (
                    <div className="w-px flex-1 mt-2 bg-gradient-to-b from-[#34D399]/20 to-transparent" />
                  )}
                </div>
                <div className="pt-2">
                  <h4 className="text-white font-semibold mb-1">{step.title}</h4>
                  <p className="text-[#71717A] text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ perspective: '1200px' }} className="hidden md:block">
          <div 
            style={{ transform: 'rotateY(-8deg) rotateX(4deg)', transformStyle: 'preserve-3d' }}
            className="rounded-[32px] overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,0.6)] border border-white/10"
          >
            {/* Browser chrome */}
            <div className="bg-[#09090B] px-4 py-3 flex items-center gap-2 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              <div className="ml-4 flex-1 bg-white/5 rounded-md h-5 text-[10px] text-white/20 flex items-center px-3 font-mono">
                app.smartmatch.org/dashboard
              </div>
            </div>

            {/* Dashboard body */}
            <div className="bg-[#09090B] p-6">
              {/* Top stat row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Volunteers Active", val: "12,847", delta: "+2.4%" },
                  { label: "Needs Open", val: "3,291", delta: "+18" },
                  { label: "Matches Today", val: "847", delta: "↑ 12%" },
                ].map((s, idx) => (
                  <div key={idx} className="bg-white/5 rounded-[16px] p-3 border border-white/5">
                    <p className="text-[#71717A] text-[10px] mb-1">{s.label}</p>
                    <p className="text-white font-bold text-lg tracking-[-0.03em]">{s.val}</p>
                    <p className="text-[#34D399] text-[10px]">{s.delta}</p>
                  </div>
                ))}
              </div>

              {/* Simulated chart bar */}
              <div className="bg-white/5 rounded-[16px] p-4 border border-white/5 mb-4">
                <p className="text-[#71717A] text-xs mb-3">Match Volume — Last 7 Days</p>
                <div className="flex items-end gap-2 h-16">
                  {[40, 65, 50, 80, 72, 90, 85].map((h, idx) => (
                    <div key={idx} className="flex-1 rounded-t-sm" style={{
                      height: `${h}%`,
                      background: idx === 5 ? '#34D399' : 'rgba(255,255,255,0.12)'
                    }} />
                  ))}
                </div>
              </div>

              {/* Recent activity list */}
              <div className="space-y-2">
                {[
                  "Volunteer matched · Medical Aid · Nairobi",
                  "New need posted · Flood Relief · Bangladesh",
                  "NGO onboarded · CARE International",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] text-[#71717A] py-1.5 border-b border-white/5 last:border-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
