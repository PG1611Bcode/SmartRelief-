import React from 'react';

/**
 * UrgencyScoreBadge component
 * Displays a clean "Urgency Score: XX" badge or pill on emergency cards.
 * Color coding:
 * - >150: Red/Critical
 * - 100-150: Orange/High
 * - <100: Blue/Standard
 */
export default function UrgencyScoreBadge({ score, className = '' }) {
  const val = typeof score === 'number' ? score : (parseInt(score, 10) || 0);

  let colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/20'; // <100 Blue/Standard
  let dotClass = 'bg-blue-400';

  if (val > 150) {
    colorClasses = 'bg-red-500/10 text-red-400 border-red-500/25'; // >150 Red/Critical
    dotClass = 'bg-red-400 animate-pulse';
  } else if (val >= 100) {
    colorClasses = 'bg-orange-500/10 text-orange-400 border-orange-500/25'; // 100-150 Orange/High
    dotClass = 'bg-orange-400';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border transition-all flex-shrink-0 ${colorClasses} ${className}`}
      title={`Automated Urgency Score: ${val}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass} flex-shrink-0`} />
      Urgency Score: {val}
    </span>
  );
}
