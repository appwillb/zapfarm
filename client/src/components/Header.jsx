import React, { useState } from 'react';
import { Menu, QrCode, Bot, User, Bell, LogOut, Key, Edit, Eye, EyeOff, Check, X, Mail } from 'lucide-react';
import AudioAlertsControl from './AudioAlertsControl';
import PharmacistBadge from './PharmacistBadge';
import { api } from '../api';

export default function Header({
  setMobileOpen,
  currentTab,
  tenant,
  whatsappStatus,
  onOpenWhatsApp,
  onOpenSimulator,
  onOpenChat,
  currentUser,
  onUpdateCurrentUser,
  onLogout,
}) {
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const handleOpenProfileModal = () => {
    setProfileData({
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      password: '',
    });
    setShowPassword(false);
    setProfileSuccess(false);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setSavingProfile(true);
    try {
      const payload = {
        name: profileData.name,
        email: profileData.email,
      };
      if (profileData.password?.trim()) {
        payload.password = profileData.password.trim();
      }
      const res = await api.updateUser(currentUser.id, payload);
      if (res.error) throw new Error(res.error);
      if (onUpdateCurrentUser && res.user) {
        onUpdateCurrentUser(res.user);
      }
      setProfileSuccess(true);
      setTimeout(() => {
        setProfileSuccess(false);
        setProfileModalOpen(false);
      }, 1500);
    } catch (err) {
      alert('Erro ao atualizar dados: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Visão Geral e Métricas';
      case 'orders':
        return 'Gestão de Pedidos e Balcão';
      case 'products':
        return 'Catálogo de Remédios e Produtos';
      case 'inventory':
        return 'Estoque, Lotes e Validades';
      case 'drivers':
        return 'Gestão de Entregadores (Motoboys)';
      case 'whatsapp':
        return 'Conexão WhatsApp (Baileys QR Code)';
      case 'chat':
        return 'Atendimento Humanizado & Histórico';
      case 'settings':
        return 'Configurações da Farmácia & Pix';
      case 'saas_admin':
        return 'Painel Master do Dono do SaaS';
      default:
        return 'ZapFarm';
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <Menu size={22} />
          </button>
          <img
            src={tenant?.logo_url || '/zapfarm-logo.png'}
            alt={tenant?.name || 'ZapFarm'}
            className="w-9 h-9 rounded-xl object-contain border border-slate-200 bg-white p-1 shadow-xs shrink-0"
          />
          <div>
            <h1 className="text-lg lg:text-xl font-bold text-slate-800 leading-tight flex items-center gap-2">
              {getTabTitle()}
            </h1>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              {tenant?.name} &bull; CNPJ: {tenant?.cnpj || 'Sem CNPJ'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* WhatsApp Fast Connect Banner Button */}
          {whatsappStatus?.status !== 'connected' ? (
            <button
              onClick={onOpenWhatsApp}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
            >
              <QrCode size={14} className="text-amber-600" />
              <span className="hidden sm:inline">Conectar WhatsApp</span>
            </button>
          ) : (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WhatsApp Online</span>
            </div>
          )}

          {/* Voice and Sound Alerts Control */}
          <AudioAlertsControl />

          {/* Animated Moving Pharmacist Mascot & Plantão Badge */}
          <PharmacistBadge
            onOpenChat={onOpenChat}
            onOpenSimulator={onOpenSimulator}
          />

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <button
              onClick={handleOpenProfileModal}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left group"
              title="Clique para editar seu nome, e-mail e senha de login"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-none group-hover:text-emerald-700 transition-colors flex items-center gap-1">
                  {currentUser?.name || 'Usuário'}
                  <Key size={11} className="text-slate-400 group-hover:text-emerald-600" />
                </p>
                <p className="text-[10px] text-slate-500 capitalize mt-0.5">
                  {currentUser?.role === 'superadmin' ? '👑 Dono SaaS' : currentUser?.role === 'pharmacist' ? 'Farmacêutica' : 'Atendente'}
                </p>
              </div>
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Sair do Sistema"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Modal: Editar Meu Perfil (Nome, E-mail de Login, Senha) */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    Minha Conta & Credenciais
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Altere seu e-mail de acesso e senha no sistema
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {profileSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-fade-in">
                <Check size={16} className="text-emerald-600" />
                <span>Dados de login atualizados com sucesso!</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Seu Nome Completo</label>
                <input
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  E-mail de Login no ZapFarm *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full p-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                  />
                  <Mail size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Este e-mail será utilizado para entrar no painel.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nova Senha de Acesso
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Deixe em branco para manter a senha atual"
                    value={profileData.password}
                    onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
                    className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold block text-slate-700 mb-0.5">Seu Nível de Permissão:</span>
                <span>
                  {currentUser?.role === 'superadmin'
                    ? '👑 Super Administrador (Acesso global SaaS)'
                    : currentUser?.role === 'pharmacist'
                    ? '💊 Farmacêutica / Gerente da Farmácia'
                    : '👤 Atendente de Balcão'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs disabled:opacity-50"
                >
                  {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
