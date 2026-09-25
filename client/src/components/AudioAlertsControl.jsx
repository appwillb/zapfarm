import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Bell, Play, Settings2, Check, Sparkles } from 'lucide-react';
import {
  getAudioConfig,
  saveAudioConfig,
  testAudioAlert,
  unlockAudio,
  requestNotificationPermission,
} from '../services/soundAlerts';

export default function AudioAlertsControl() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(getAudioConfig());
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [notifGranted, setNotifGranted] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const update = (patch) => {
    const updated = saveAudioConfig(patch);
    setConfig(updated);
  };

  const handleTest = () => {
    unlockAudio();
    setIsPlayingTest(true);
    testAudioAlert('Rozana');
    setTimeout(() => setIsPlayingTest(false), 3000);
  };

  const handleRequestNotif = async () => {
    const ok = await requestNotificationPermission();
    setNotifGranted(ok);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button in Header */}
      <button
        onClick={() => {
          unlockAudio();
          setOpen(!open);
        }}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
          config.enabled
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs'
            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
        }`}
        title="Configurações de Alerta Sonoro e Voz do Balcão"
      >
        {config.enabled ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <Volume2 size={15} className="text-emerald-600 shrink-0" />
            <span className="hidden md:inline font-medium">Voz do Balcão ON</span>
          </>
        ) : (
          <>
            <VolumeX size={15} className="text-slate-400 shrink-0" />
            <span className="hidden md:inline font-medium">Voz Mudo</span>
          </>
        )}
      </button>

      {/* Popover Menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Volume2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Voz & Chamada do Balcão</h3>
                <p className="text-[11px] text-slate-500">Alerta falado ao receber WhatsApp</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="space-y-3.5 pt-3">
            {/* Mode Selector */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1.5 uppercase tracking-wider">
                Modo de Notificação
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => update({ mode: 'voice_and_chime' })}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all ${
                    config.mode === 'voice_and_chime'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Voz + Toque
                </button>
                <button
                  type="button"
                  onClick={() => update({ mode: 'chime_only' })}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all ${
                    config.mode === 'chime_only'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Só Toque
                </button>
                <button
                  type="button"
                  onClick={() => update({ mode: 'voice_only' })}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all ${
                    config.mode === 'voice_only'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Só Voz
                </button>
              </div>
            </div>

            {/* Volume Slider */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <span>Volume da Voz & Sino</span>
                <span className="text-emerald-600 font-bold">{Math.round(config.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={config.volume}
                onChange={(e) => update({ volume: parseFloat(e.target.value) })}
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            {/* Test Voice Announcement Button */}
            <button
              type="button"
              onClick={handleTest}
              disabled={isPlayingTest}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs ${
                isPlayingTest
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98 shadow-emerald-600/20'
              }`}
            >
              <Play size={14} className={isPlayingTest ? 'animate-spin' : ''} />
              <span>
                {isPlayingTest ? 'Falando no alto-falante...' : 'Ouvir Teste: "Cliente Rozana..."'}
              </span>
            </button>

            {/* Desktop Notification Banner */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-600 flex items-center gap-1">
                <Bell size={12} className="text-slate-400" />
                <span>Notificações no Windows:</span>
              </span>
              {notifGranted ? (
                <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                  <Check size={12} />
                  Ativadas
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestNotif}
                  className="text-emerald-700 font-bold underline hover:text-emerald-800"
                >
                  Permitir
                </button>
              )}
            </div>

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              💡 Funciona em segundo plano mesmo se você estiver em outra aba ou sistema fiscal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
