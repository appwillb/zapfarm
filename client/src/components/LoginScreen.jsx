import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Building2, Store, ArrowLeft } from 'lucide-react';

export default function LoginScreen({ onLoginSuccess }) {
  // Check if URL specifies admin route (/admin or ?admin=true)
  const [isAdminMode, setIsAdminMode] = useState(() => {
    return (
      window.location.pathname.startsWith('/admin') ||
      window.location.search.includes('admin=true')
    );
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill placeholder based on mode
  useEffect(() => {
    setError('');
    if (isAdminMode) {
      setEmail('');
      setPassword('');
    } else {
      setEmail('');
      setPassword('');
    }
  }, [isAdminMode]);

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

      // Check if trying to access admin mode with non-superadmin account
      if (isAdminMode && data.user.role !== 'superadmin') {
        throw new Error('Esta conta não possui permissões de Administrador Master da plataforma.');
      }

      onLoginSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div
        className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
          isAdminMode ? 'bg-indigo-600/15' : 'bg-emerald-500/10'
        }`}
      />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl mx-auto font-bold transition-all duration-300 ${
              isAdminMode
                ? 'bg-gradient-to-tr from-indigo-700 to-purple-600 shadow-indigo-600/20'
                : 'bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-emerald-500/20'
            }`}
          >
            {isAdminMode ? '👑' : '⚕️'}
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
              ZapFarm{' '}
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  isAdminMode
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isAdminMode ? 'Master Admin' : 'SaaS'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isAdminMode
                ? 'Painel de Gestão e Operações da Plataforma (Restrito)'
                : 'Portal de Vendas e Atendimento da Farmácia no WhatsApp'}
            </p>
          </div>
        </div>

        {/* Login Box */}
        <div
          className={`bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 border transition-all duration-300 ${
            isAdminMode ? 'border-indigo-900/60 shadow-indigo-950/50' : 'border-slate-800'
          }`}
        >
          {isAdminMode && (
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={13} /> Acesso Master da Plataforma
              </span>
              <button
                type="button"
                onClick={() => setIsAdminMode(false)}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ArrowLeft size={12} />
                Portal da Farmácia
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-300 font-bold block mb-1.5">
                {isAdminMode ? 'E-mail do Administrador Master' : 'E-mail da Farmácia'}
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAdminMode ? 'admin@zapfarm.com' : 'farmacia@exemplo.com.br'}
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
                    isAdminMode
                      ? 'border-indigo-700/60 focus:border-indigo-400'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
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
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
                    isAdminMode
                      ? 'border-indigo-700/60 focus:border-indigo-400'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-xs mt-2 ${
                isAdminMode
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              }`}
            >
              <span>{loading ? 'Autenticando...' : isAdminMode ? 'Entrar no Painel Master' : 'Entrar no Sistema'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Discreet Footer Link for Master Admin Access */}
          {!isAdminMode && (
            <div className="pt-3 border-t border-slate-800/60 text-center">
              <button
                type="button"
                onClick={() => setIsAdminMode(true)}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1"
              >
                <span>Área do Administrador da Plataforma (Master)</span>
                <ArrowRight size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Security Footer */}
        <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck size={13} className={isAdminMode ? 'text-indigo-400' : 'text-emerald-500'} />
          Multi-tenancy com isolamento de dados por token JWT criptografado
        </p>
      </div>
    </div>
  );
}
