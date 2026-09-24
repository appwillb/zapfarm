import React from 'react';
import {
  TrendingUp,
  Clock,
  PackageCheck,
  Bike,
  AlertTriangle,
  QrCode,
  ArrowRight,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

export default function DashboardTab({
  dashboardData,
  onNavigateTab,
  onOpenOrder,
  onConfirmPayment,
  onReleaseDelivery,
}) {
  const metrics = dashboardData?.metrics || {};
  const lowStock = dashboardData?.lowStockProducts || [];
  const recentOrders = dashboardData?.recentOrders || [];
  const whatsapp = dashboardData?.whatsapp || {};

  const cards = [
    {
      title: 'Faturamento Hoje',
      value: `R$ ${(metrics.todayRevenue || 0).toFixed(2)}`,
      subtitle: `Total acumulado: R$ ${(metrics.totalRevenue || 0).toFixed(2)}`,
      icon: TrendingUp,
      color: 'emerald',
      bg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Aguardando Pagamento',
      value: metrics.pendingOrders || 0,
      subtitle: 'Clientes com chave Pix gerada',
      icon: Clock,
      color: 'amber',
      bg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Em Separação no Balcão',
      value: metrics.preparingOrders || 0,
      subtitle: 'Pagamento Pix aprovado',
      icon: PackageCheck,
      color: 'blue',
      bg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Em Rota com Motoboy',
      value: metrics.inTransitOrders || 0,
      subtitle: `${metrics.onDeliveryDrivers || 0} entregador(es) em trânsito`,
      icon: Bike,
      color: 'purple',
      bg: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* WhatsApp Connection Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <QrCode size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Robô Baileys WhatsApp</h2>
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                  whatsapp.status === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : whatsapp.status === 'qrcode'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {whatsapp.status === 'connected'
                  ? 'Ativo & Respondendo'
                  : whatsapp.status === 'qrcode'
                  ? 'Aguardando Escanear QR'
                  : 'Desconectado'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {whatsapp.status === 'connected'
                ? `Conectado ao número +${whatsapp.phone || ''}. Clientes recebem respostas automáticas do estoque.`
                : 'Escaneie o QR Code para ativar o robô de vendas e atendimento da farmácia.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigateTab('whatsapp')}
          className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          {whatsapp.status === 'connected' ? 'Ver Status da Conexão' : 'Escanear QR Code'}
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{card.title}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.bg}`}>
                  <Icon size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800 mt-2">{card.value}</p>
              <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Main Two Columns: Recent Orders & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Orders (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Últimos Pedidos via WhatsApp</h2>
              <p className="text-xs text-slate-500">Pedidos gerados pelo bot e balcão</p>
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
            >
              Ver Kanban Completo
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Pedido</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Itens</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Nenhum pedido recente registrado.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => {
                    const statusConfig = {
                      pending_payment: { label: 'Aguardando Pix', color: 'bg-amber-100 text-amber-800' },
                      paid: { label: 'Pago / Em Separação', color: 'bg-blue-100 text-blue-800' },
                      ready_for_delivery: { label: 'Pronto / Liberado', color: 'bg-indigo-100 text-indigo-800' },
                      in_transit: { label: 'Em Rota (Motoboy)', color: 'bg-purple-100 text-purple-800' },
                      delivered: { label: 'Entregue', color: 'bg-emerald-100 text-emerald-800' },
                      cancelled: { label: 'Cancelado', color: 'bg-rose-100 text-rose-800' },
                    }[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-700' };

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-800">#{order.id}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-700">{order.customer_name || 'Cliente'}</p>
                          <p className="text-[10px] text-slate-400">{order.customer_phone}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-600 truncate block max-w-[150px]">
                            {order.items?.map((i) => `${i.quantity}x ${i.product_name}`).join(', ') || 'Sem itens'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          R$ {Number(order.total).toFixed(2)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {order.status === 'pending_payment' && (
                              <button
                                onClick={() => onConfirmPayment(order.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold transition-colors"
                                title="Confirmar recebimento do Pix"
                              >
                                Confirmar Pix
                              </button>
                            )}
                            {order.status === 'paid' && (
                              <button
                                onClick={() => onReleaseDelivery(order.id)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1"
                                title="Liberar e acionar motoboy no WhatsApp"
                              >
                                <Bike size={12} />
                                Liberar Motoboy
                              </button>
                            )}
                            <button
                              onClick={() => onOpenOrder(order)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                              title="Ver detalhes do pedido"
                            >
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Low Stock Alerts (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle size={15} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Estoque Baixo & Crítico</h2>
                <p className="text-xs text-slate-500">Medicamentos para reposição</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">
              {lowStock.length} alertas
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px] pr-1">
            {lowStock.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle size={32} className="mx-auto text-emerald-500/60 mb-2" />
                <p className="text-xs font-medium">Estoque saudável! Nenhum item em nível crítico.</p>
              </div>
            ) : (
              lowStock.map((prod) => (
                <div
                  key={prod.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between hover:bg-slate-100/60 transition-colors"
                >
                  <div className="pr-2">
                    <p className="font-semibold text-slate-800 text-xs">{prod.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {prod.dosage} &bull; Mínimo: {prod.min_stock} un.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                      {prod.stock_quantity} un.
                    </span>
                    {prod.reserved_quantity > 0 && (
                      <p className="text-[9px] text-amber-600 font-medium">
                        {prod.reserved_quantity} reservada(s)
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => onNavigateTab('products')}
            className="mt-4 w-full py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Gerenciar Estoque Completo
          </button>
        </div>
      </div>
    </div>
  );
}
