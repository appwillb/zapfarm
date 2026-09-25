import React, { useEffect, useState } from 'react';
import { PhoneCall, MessageSquare, X, Volume2, User, ArrowRight, ShieldAlert } from 'lucide-react';

function formatPhone(phone) {
  if (!phone) return '';
  if (phone.includes('@lid')) return 'WhatsApp';
  const clean = phone.replace(/[^\d]/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12 && clean.startsWith('55')) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return phone;
}

export default function IncomingCallToast({ alert, onOpenChat, onDismiss }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!alert) return;

    setProgress(100);
    const duration = 12000; // 12 seconds
    const interval = 100;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [alert?.id]);

  if (!alert) return null;

  const isHuman = alert.type === 'human_support';
  const displayName = alert.customerName || 'Novo Cliente';

  return (
    <div className="fixed top-20 right-4 z-50 max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div
        className={`relative overflow-hidden rounded-2xl shadow-2xl border ${
          isHuman
            ? 'bg-amber-900/95 border-amber-500 text-white shadow-amber-900/30'
            : 'bg-slate-900/95 border-emerald-500/80 text-white shadow-emerald-950/40'
        } backdrop-blur-md p-4 transition-all`}
      >
        {/* Progress Bar Countdown */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
          <div
            className={`h-full transition-all ease-linear ${isHuman ? 'bg-amber-400' : 'bg-emerald-400'}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-start gap-3.5 pt-1">
          {/* Animated Pulsing Icon */}
          <div className="relative shrink-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${
                isHuman
                  ? 'bg-gradient-to-tr from-amber-600 to-amber-400 text-white'
                  : 'bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white'
              }`}
            >
              {isHuman ? <ShieldAlert size={26} /> : <PhoneCall size={24} className="animate-bounce" />}
            </div>
            {/* Ping Radar */}
            <span
              className={`absolute -top-1 -right-1 flex h-4 w-4 rounded-full ${
                isHuman ? 'bg-amber-400' : 'bg-emerald-400'
              } animate-ping opacity-75`}
            />
            <span
              className={`absolute -top-1 -right-1 flex h-4 w-4 rounded-full ${
                isHuman ? 'bg-amber-500' : 'bg-emerald-500'
              } border-2 border-slate-900`}
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                    isHuman ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isHuman ? '👨‍⚕️ Atendente Solicitado' : '💬 Chamando no Balcão'}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium animate-pulse">
                  <Volume2 size={12} />
                  <span>Voz ativa</span>
                </span>
              </div>
              <button
                onClick={onDismiss}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Dispensar alerta"
              >
                <X size={16} />
              </button>
            </div>

            <h4 className="text-base font-bold text-white mt-1 truncate flex items-center gap-1.5">
              <span>{displayName}</span>
            </h4>
            <p className="text-xs text-slate-300 truncate font-mono">
              {formatPhone(alert.customerPhone)}
            </p>

            {alert.text && (
              <p className="text-xs text-slate-300/90 mt-1.5 line-clamp-2 bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/5 italic">
                "{alert.text}"
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onOpenChat(alert.customerPhone)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                  isHuman
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                }`}
              >
                <MessageSquare size={14} />
                <span>Atender Conversa Agora</span>
                <ArrowRight size={14} />
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                Dispensar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
