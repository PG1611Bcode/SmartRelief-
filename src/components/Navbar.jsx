import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar({ onLogin, onSignup }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-full flex items-center justify-between px-6 py-3 max-w-3xl w-[92%] transition-all duration-300 border border-[rgba(255,255,255,0.10)] ${
        scrolled 
          ? 'bg-white/8 backdrop-blur-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]' 
          : 'bg-white/5 backdrop-blur-[12px]'
      }`}
    >
      <div className="flex items-center">
        <span className="font-extrabold tracking-[-0.05em] text-white text-lg">SmartMatch</span>
        <span className="text-[#34D399] text-xs font-medium ml-2 opacity-80 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
          NGO Platform
        </span>
      </div>

      <div className="hidden md:flex items-center gap-6 text-[#A1A1AA] text-sm font-medium">
        <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
        <a href="#features" className="hover:text-white transition">Features</a>
        <a href="#impact" className="hover:text-white transition">Impact</a>
      </div>

      <div className="flex items-center gap-4">
        <Link 
          to="/login"
          className="hidden sm:block border border-[rgba(255,255,255,0.15)] text-white/80 hover:text-white rounded-full px-5 py-2 text-sm transition"
        >
          Log In
        </Link>
        <Link 
          to="/signup"
          className="bg-[#34D399] text-[#09090B] font-semibold rounded-full px-5 py-2 text-sm hover:bg-[#10B981] transition"
        >
          Get Started
        </Link>
      </div>
    </nav>
  );
}
