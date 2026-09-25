import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ShieldCheck, MessageSquare, Bot, X, Stethoscope, ChevronDown } from 'lucide-react';

export default function PharmacistBadge({ onOpenChat, onOpenSimulator }) {
  const [open, setOpen] = useState(false);
  const badgeRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={badgeRef}>
      <style>{`
        @keyframes pharmacist-float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-3px) rotate(1.2deg);
          }
        }
        @keyframes pharmacist-wave {
          0%, 100% {
            transform: rotate(0deg);
          }
          20% {
            transform: rotate(-14deg);
          }
          40% {
            transform: rotate(10deg);
          }
          60% {
            transform: rotate(-10deg);
          }
          80% {
            transform: rotate(6deg);
          }
        }
        @keyframes sparkle-float {
          0% {
            opacity: 0;
            transform: translateY(0px) scale(0.6);
          }
          50% {
            opacity: 1;
            transform: translateY(-8px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-16px) scale(0.8);
          }
        }
        .animate-pharmacist-float {
          animation: pharmacist-float 3.5s ease-in-out infinite;
        }
        .animate-sparkle-1 {
          animation: sparkle-float 3s ease-in-out infinite;
        }
        .animate-sparkle-2 {
          animation: sparkle-float 3s ease-in-out infinite 1.5s;
        }
      `}</style>

      {/* Main Interactive Button in Header */}
      <button
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/15 to-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 shadow-xs hover:shadow-emerald-500/15 transition-all text-left"
        title="Farmacêutica de Plantão • Clique para ver detalhes"
      >
        {/* Animated Avatar Container */}
        <div className="relative shrink-0">
          {/* Pulsing Green Radar Wave */}
          <span className="absolute -inset-1 rounded-full bg-emerald-400 opacity-40 animate-ping duration-1000" />
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-50 blur-xs" />

          {/* Floating Avatar with Movement */}
          <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-emerald-400 bg-white shadow-md animate-pharmacist-float group-hover:scale-105 transition-transform">
            <img
              src="/pharmacist-avatar.png"
              alt="Farmacêutica de Plantão"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Online Indicator Badge */}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </span>

          {/* Floating Particle */}
          <span className="absolute -top-2 -right-1 text-[9px] text-emerald-500 font-bold pointer-events-none animate-sparkle-1">
            ➕
          </span>
        </div>

        {/* Text Info */}
        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-slate-800 tracking-tight leading-tight group-hover:text-emerald-700 transition-colors">
              Farmacêutica de Plantão
            </span>
            <span className="text-[10px] text-amber-500 animate-bounce">✨</span>
          </div>
          <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 leading-none mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Supervisionando WhatsApp</span>
          </p>
        </div>

        <ChevronDown size={13} className={`text-slate-400 group-hover:text-emerald-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Card */}
      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-[340px] sm:w-84 bg-white rounded-3xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
          <div className="flex items-start justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-emerald-400 bg-white shadow-md">
                <img
                  src="/pharmacist-avatar.png"
                  alt="Farmacêutica"
                  className="w-full h-full object-cover animate-pharmacist-float"
                />
                <span className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                  <span>Dra. Camila Santos</span>
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                </h4>
                <p className="text-[11px] text-emerald-700 font-semibold">Farmacêutica Responsável</p>
                <p className="text-[10px] text-slate-400">CRF-SP Ativo &bull; Plantão Presencial</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </div>

          <div className="py-3 space-y-2.5">
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-slate-700 flex items-start gap-2">
              <Stethoscope size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                O atendimento farmacêutico e triagem de receitas estão ativos no WhatsApp. Você pode assumir qualquer conversa a qualquer instante.
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              {onOpenChat && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onOpenChat();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-bold text-slate-800 hover:text-emerald-700 transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-emerald-600" />
                    <span>Ver Atendimentos no Chat</span>
                  </span>
                  <span className="text-[11px] text-slate-400 group-hover:text-emerald-600 font-normal">Abrir &rarr;</span>
                </button>
              )}

              {onOpenSimulator && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onOpenSimulator();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Bot size={14} className="text-slate-500" />
                    <span>Abrir Simulador de Teste</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Testar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
