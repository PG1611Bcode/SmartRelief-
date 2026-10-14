import React, { useState } from 'react';

export default function SignupModal({ onClose, onSwitch }) {
  const [role, setRole] = useState('volunteer'); // volunteer | organisation

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      
      <div className="relative z-10 w-full max-w-md rounded-[32px] p-10 bg-[#09090B]/90 border border-white/10 shadow-2xl backdrop-blur-xl">
        <h2 className="text-3xl font-extrabold tracking-[-0.05em] text-white mb-1">Join the mission.</h2>
        <p className="text-[#71717A] text-sm mb-8">Create your SmartMatch volunteer profile.</p>

        {/* Role Toggle */}
        <div className="flex p-1 bg-white/5 rounded-full mb-6 relative">
          {/* Animated Background Pill */}
          <div 
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#34D399] rounded-full transition-transform duration-300 ease-in-out"
            style={{ 
              transform: role === 'volunteer' ? 'translateX(0)' : 'translateX(100%)',
              left: role === 'volunteer' ? '4px' : '0px'
            }}
          />

          <button 
            onClick={() => setRole('volunteer')}
            className={`relative z-10 flex-1 text-xs font-semibold py-2 rounded-full transition-colors duration-300 ${
              role === 'volunteer' 
                ? 'text-[#09090B]' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            I am a Volunteer
          </button>
          <button 
            onClick={() => setRole('organisation')}
            className={`relative z-10 flex-1 text-xs font-semibold py-2 rounded-full transition-colors duration-300 ${
              role === 'organisation' 
                ? 'text-[#09090B]' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            I represent an NGO
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-[#A1A1AA] text-xs font-medium mb-1.5 uppercase tracking-widest">
            Full Name
          </label>
          <input 
            type="text" 
            placeholder="Your full name" 
            className="w-full bg-white/5 border border-white/10 rounded-[14px] px-4 py-3 text-white placeholder-[#52525B] text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

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
          <label className="block text-[#A1A1AA] text-xs font-medium mb-1.5 uppercase tracking-widest">
            Password
          </label>
          <input 
            type="password" 
            placeholder="Create a password" 
            className="w-full bg-white/5 border border-white/10 rounded-[14px] px-4 py-3 text-white placeholder-[#52525B] text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

        <p className="text-[#52525B] text-xs mt-4 mb-4">
          By creating an account, you agree to SmartMatch's{' '}
          <a href="#" className="text-[#34D399] hover:underline">Terms of Use</a> and{' '}
          <a href="#" className="text-[#34D399] hover:underline">Privacy Policy</a>.
        </p>

        <button className="bg-[#34D399] text-[#09090B] font-bold w-full py-3.5 rounded-full hover:bg-[#10B981] transition mt-2">
          Create My Account
        </button>

        <p className="text-[#71717A] text-sm text-center mt-6">
          Already have an account?{' '}
          <button onClick={onSwitch} className="text-[#34D399] font-semibold hover:underline">
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}
