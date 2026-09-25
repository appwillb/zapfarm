import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Pill,
  Boxes,
  Bike,
  QrCode,
  MessageSquare,
  Bot,
  Building2,
  Settings,
  ChevronDown,
  X,
  ShieldCheck,
  Megaphone,
} from 'lucide-react';

export default function Sidebar({
  currentTab,
  setCurrentTab,
  tenants,
  selectedTenant,
  setSelectedTenant,
  whatsappStatus,
  mobileOpen,
  setMobileOpen,
  onOpenSimulator,
  currentUser,
}) {
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Pedidos & Balcão', icon: ShoppingBag, badge: 'Fluxo' },
    { id: 'products', label: 'Produtos & Remédios', icon: Pill },
    { id: 'inventory', label: 'Estoque & Lotes', icon: Boxes },
    { id: 'drivers', label: 'Entregadores', icon: Bike },
    { id: 'whatsapp', label: 'Conexão WhatsApp', icon: QrCode, highlight: true },
    { id: 'chat', label: 'Atendimento & Chat', icon: MessageSquare },
    { id: 'campaigns', label: 'Disparos & Ofertas', icon: Megaphone, badge: 'Anti-Ban' },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'saas_admin', label: 'Painel Dono SaaS', icon: Building2, adminOnly: true },
  ];

  const visibleMenuItems = menuItems.filter(
    (item) => !item.adminOnly || isSuperAdmin
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/zapfarm-logo.png"
              alt="ZapFarm Logo"
              className="w-10 h-10 object-contain drop-shadow-md hover:scale-105 transition-transform shrink-0"
            />
            <div>
              <span className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
                ZapFarm <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-1.5 py-0.5 rounded-full border border-emerald-500/30">SaaS</span>
              </span>
              <p className="text-[11px] text-slate-400">Farmácia no WhatsApp</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tenant / Pharmacy Area */}
        <div className="p-3 border-b border-slate-800/80">
          {isSuperAdmin ? (
            <div>
              <div className="flex items-center justify-between mb-1.5 px-2">
                <label className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                  👑 Gerenciar Farmácia
                </label>
                <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 rounded">Superadmin</span>
              </div>
              <div className="relative">
                <select
                  value={selectedTenant?.id || ''}
                  onChange={(e) => {
                    const found = tenants.find((t) => t.id === Number(e.target.value));
                    if (found) setSelectedTenant(found);
                  }}
                  className="w-full bg-slate-800/90 text-xs font-semibold text-slate-100 rounded-lg px-3 py-2 pr-8 appearance-none border border-slate-700/60 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
              </div>
              {selectedTenant?.logo_url && (
                <div className="mt-2 flex items-center gap-2 px-1">
                  <img
                    src={selectedTenant.logo_url}
                    alt={selectedTenant.name}
                    className="w-6 h-6 rounded-md object-contain bg-white p-0.5 shrink-0"
                  />
                  <span className="text-[11px] text-slate-300 truncate">{selectedTenant.name}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="px-2 py-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Sua Farmácia
              </label>
              <div className="p-2.5 bg-slate-800/70 rounded-xl border border-slate-700/60 flex items-center gap-2.5">
                {selectedTenant?.logo_url ? (
                  <img
                    src={selectedTenant.logo_url}
                    alt={selectedTenant.name}
                    className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-sm">
                    💊
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{selectedTenant?.name}</p>
                  <p className="text-[10px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Plano {selectedTenant?.plan?.toUpperCase()} &bull; Ativa
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'whatsapp' && (
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      whatsappStatus?.status === 'connected'
                        ? 'bg-emerald-400 shadow-xs shadow-emerald-400 animate-pulse'
                        : whatsappStatus?.status === 'qrcode'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-slate-500'
                    }`}
                  />
                )}
                {item.badge && !isActive && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-md border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 border-t border-slate-800/80 my-2">
            <button
              onClick={onOpenSimulator}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all text-left"
            >
              <Bot size={18} className="text-emerald-400 animate-bounce" />
              <div className="flex-1">
                <span>Simulador do Bot</span>
                <span className="block text-[10px] text-emerald-400/80 font-normal">Testar WhatsApp na tela</span>
              </div>
            </button>
          </div>
        </nav>

        {/* WhatsApp Footer Status */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  whatsappStatus?.status === 'connected'
                    ? 'bg-emerald-400'
                    : whatsappStatus?.status === 'qrcode'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              Baileys WhatsApp:
            </span>
            <span className="font-semibold text-slate-200 capitalize">
              {whatsappStatus?.status === 'connected'
                ? 'Conectado'
                : whatsappStatus?.status === 'qrcode'
                ? 'Aguardando QR'
                : 'Desconectado'}
            </span>
          </div>
          {whatsappStatus?.phone && (
            <p className="text-[11px] text-slate-400 truncate mt-1">📱 +{whatsappStatus.phone}</p>
          )}
        </div>
      </aside>
    </>
  );
}
