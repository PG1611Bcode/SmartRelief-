import React from 'react';

export default function LoginModal({ onClose, onSwitch }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md rounded-[32px] p-10 bg-[#09090B]/90 border border-white/10 shadow-2xl backdrop-blur-xl">
        <h2 className="text-3xl font-extrabold tracking-[-0.05em] text-white mb-1">Welcome back.</h2>
        <p className="text-[#71717A] text-sm mb-8">Sign in to your SmartMatch account.</p>

        <div className="mb-4">
          <label className="block text-[#A1A1AA] text-xs font-medium mb-1.5 uppercase tracking-widest">
            Email Address
          </label>
          <input 
            type="email" 
            placeholder="your@email.com" 
            className="w-full bg-white/5 border border-white/10 rounded-[14px] px-4 py-3 text-white placeholder-[#52525B] text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[#A1A1AA] text-xs font-medium uppercase tracking-widest">
              Password
            </label>
            <a href="#" className="text-[#34D399] text-xs hover:underline">Forgot password?</a>
          </div>
          <input 
            type="password" 
            placeholder="••••••••" 
            className="w-full bg-white/5 border border-white/10 rounded-[14px] px-4 py-3 text-white placeholder-[#52525B] text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

        <button className="bg-[#34D399] text-[#09090B] font-bold w-full py-3.5 rounded-full hover:bg-[#10B981] transition mt-2">
          Sign In to SmartMatch
        </button>

        <div className="flex items-center gap-4 my-6 opacity-30">
          <div className="h-px flex-1 bg-white" />
          <span className="text-white text-xs font-medium px-2">or continue with</span>
          <div className="h-px flex-1 bg-white" />
        </div>

        <button className="w-full py-3.5 rounded-full border border-white/10 text-white font-semibold hover:bg-white/5 transition flex items-center justify-center gap-2">
          Google
        </button>

        <p className="text-[#71717A] text-sm text-center mt-6">
          New to SmartMatch?{' '}
          <button onClick={onSwitch} className="text-[#34D399] font-semibold hover:underline">
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
