export default function GlassCard({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-zinc-900/40 backdrop-blur-xl border border-[rgba(255,255,255,0.08)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
