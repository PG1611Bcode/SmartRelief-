import { useRef, useState } from 'react';
import { X } from 'lucide-react';

const MAX_SKILLS = 12;

export default function SkillsTagInput({ value = [], onChange, error }) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  const addSkill = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed || value.length >= MAX_SKILLS) return;
    if (value.map((s) => s.toLowerCase()).includes(trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
    setInputVal('');
  };

  const removeSkill = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill(inputVal);
    } else if (e.key === ',') {
      e.preventDefault();
      addSkill(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      removeSkill(value.length - 1);
    }
  };

  const atMax = value.length >= MAX_SKILLS;

  return (
    <div>
      <div
        className={`flex flex-wrap gap-2 p-3 min-h-[48px] bg-white/5 border rounded-[12px] transition cursor-text ${
          error
            ? 'border-red-500/50'
            : 'border-[rgba(255,255,255,0.08)] focus-within:border-[#34D399]/50'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((skill, idx) => (
          <span
            key={idx}
            className="px-3 py-1 rounded-full bg-[#34D399]/10 border border-[#34D399]/20 text-[#34D399] text-xs font-medium flex items-center gap-1.5"
          >
            {skill}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeSkill(idx); }}
              className="text-[#34D399]/60 hover:text-[#34D399] transition leading-none"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {!atMax && (
          <input
            ref={inputRef}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? 'Type a skill and press Enter...' : ''}
            className="flex-1 min-w-[140px] bg-transparent text-white text-sm placeholder-zinc-600 outline-none"
          />
        )}
      </div>
      {atMax && (
        <p className="text-zinc-500 text-xs mt-1">Maximum 12 skills reached</p>
      )}
      {error && !atMax && (
        <p className="text-red-400 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}
