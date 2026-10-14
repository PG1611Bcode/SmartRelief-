import { useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function Toast({ type = 'success', message, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const show = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss after 4 seconds
    const dismiss = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200);
    }, 4000);
    return () => {
      clearTimeout(show);
      clearTimeout(dismiss);
    };
  }, [onDismiss]);

  const isSuccess = type === 'success';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-200 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div
        className={`bg-zinc-900/90 backdrop-blur-xl border border-[rgba(255,255,255,0.08)] rounded-[16px] px-5 py-4 flex items-center gap-3 min-w-[300px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${
          isSuccess ? 'border-l-2 border-[#34D399]' : 'border-l-2 border-red-500'
        }`}
      >
        {isSuccess ? (
          <CheckCircle size={18} className="text-[#34D399] flex-shrink-0" />
        ) : (
          <XCircle size={18} className="text-red-400 flex-shrink-0" />
        )}
        <p className="text-white text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
