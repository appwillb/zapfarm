import React from 'react';
import { Menu, QrCode, Bot, User, Bell, LogOut } from 'lucide-react';
import AudioAlertsControl from './AudioAlertsControl';

export default function Header({
  setMobileOpen,
  currentTab,
  tenant,
  whatsappStatus,
  onOpenWhatsApp,
  onOpenSimulator,
  currentUser,
  onLogout,
}) {
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

        {/* Bot Simulator Trigger */}
        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 transition-all"
        >
          <Bot size={14} />
          <span className="hidden sm:inline">Simular Conversa</span>
        </button>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-xs">
            {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-none">{currentUser?.name || 'Usuário'}</p>
            <p className="text-[10px] text-slate-500 capitalize">
              {currentUser?.role === 'superadmin' ? '👑 Dono SaaS' : currentUser?.role === 'pharmacist' ? 'Farmacêutica' : 'Atendente'}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
            title="Sair do Sistema"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
