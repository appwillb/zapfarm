import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Building2, Store } from 'lucide-react';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('camila@farmaciacentral.com.br');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciais inválidas');
      }

      onLoginSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (testEmail, testPass) => {
    setEmail(testEmail);
    setPassword(testPass);
    setTimeout(() => {
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPass }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.token) onLoginSuccess(data);
        });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white text-3xl shadow-xl shadow-emerald-500/20 mx-auto font-bold">
            ⚕️
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            ZapFarm <span className="text-xs bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">SaaS</span>
          </h1>
          <p className="text-xs text-slate-400">
            Acesso Seguro ao Sistema de Vendas e Atendimento da Farmácia
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-300 font-bold block mb-1.5">E-mail de Acesso</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu-email@farmacia.com.br"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1.5">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-xs mt-2"
            >
              <span>{loading ? 'Autenticando...' : 'Entrar no Sistema'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 text-center">
              🧪 Testar Níveis de Acesso com 1 Clique:
            </p>

            <div className="grid grid-cols-1 gap-2 text-left">
              <button
                type="button"
                onClick={() => handleQuickLogin('camila@farmaciacentral.com.br', 'admin123')}
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors flex items-center justify-between text-xs group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Store size={14} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200 group-hover:text-emerald-300">
                      Entrar como Farmácia Central (Dra. Camila)
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Acesso isolado: vê apenas o estoque e pedidos dela
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">Entrar &rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@zapfarm.com', 'admin123')}
                className="p-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/30 transition-colors flex items-center justify-between text-xs group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Building2 size={14} />
                  </div>
                  <div>
                    <p className="font-semibold text-indigo-200 group-hover:text-indigo-100">
                      Entrar como Dono da Plataforma (Superadmin)
                    </p>
                    <p className="text-[10px] text-indigo-400/80">
                      Acesso Master: cadastra farmácias e define planos
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-indigo-300 font-mono">Entrar &rarr;</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security Footer */}
        <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-500" />
          Multi-tenancy com isolamento de dados por token JWT criptografado
        </p>
      </div>
    </div>
  );
}
