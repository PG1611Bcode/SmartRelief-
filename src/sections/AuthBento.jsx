import React from 'react';
import { Link } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import GrainOverlay from '../components/GrainOverlay';

export default function AuthBento({ openSignup, openLogin }) {
  return (
    <section id="impact" className="relative overflow-hidden bg-[#09090B] py-32 px-6">
      <GrainOverlay />
      <div className="relative z-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        
        {/* LEFT CTA */}
        <div>
          <h2 className="text-6xl font-extrabold tracking-[-0.05em] text-white leading-tight">
            Ready to<br/>
            <span className="text-[#34D399]">make impact?</span>
          </h2>
          <p className="text-[#71717A] text-lg mt-4 mb-8 max-w-sm">
            Join thousands of volunteers and hundreds of NGOs using SmartMatch to coordinate 
            real-world change — faster than ever before.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/signup" className="bg-[#34D399] text-[#09090B] font-bold px-8 py-4 rounded-full hover:bg-[#10B981] transition inline-block text-center">
              Create Free Account
            </Link>
            <Link to="/login" className="border border-white/20 text-white px-8 py-4 rounded-full hover:bg-white/5 transition inline-block text-center">
              Log In
            </Link>
          </div>
        </div>

        {/* RIGHT BENTO */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="col-span-2 rounded-[24px] p-6 text-center">
            <h4 className="text-white font-bold mb-4">240+ NGOs trust SmartMatch</h4>
            <div className="flex flex-wrap items-center justify-center gap-8 text-[#A1A1AA] text-2xl font-black tracking-widest opacity-40">
              <span>UNHCR</span>
              <span>CARE</span>
              <span>WWF</span>
              <span>OXFAM</span>
            </div>
          </GlassCard>
          
          <GlassCard className="rounded-[24px] p-6">
            <p className="text-[#71717A] text-sm mb-2">Matching Speed</p>
            <h3 className="text-[#34D399] text-3xl font-extrabold tracking-tight">Sub-60s</h3>
            <p className="text-[#A1A1AA] text-xs mt-1">Average connection time</p>
          </GlassCard>

          <GlassCard className="rounded-[24px] p-6">
             <p className="text-[#71717A] text-sm mb-2">Lives Impacted</p>
             <h3 className="text-white text-3xl font-extrabold tracking-tight">98,402</h3>
             <p className="text-[#A1A1AA] text-xs mt-1">Confirmed field operations</p>
          </GlassCard>

          <GlassCard className="col-span-2 rounded-[24px] p-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl text-[#34D399] opacity-30 leading-none">"</div>
              <div>
                <p className="text-white italic text-sm leading-relaxed mb-3">
                  SmartMatch found me a mission aligned with my ER skills within the hour.
                </p>
                <p className="text-[#71717A] text-xs font-semibold">
                  Priya S., Emergency Nurse · Mumbai
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

      </div>
    </section>
  );
}
