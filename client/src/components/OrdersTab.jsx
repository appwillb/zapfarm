import React, { useState } from 'react';
import {
  Kanban,
  Table as TableIcon,
  Search,
  CheckCircle,
  Bike,
  Clock,
  Eye,
  XCircle,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { canUser } from '../utils/permissions';

export default function OrdersTab({
  orders,
  drivers,
  currentUser,
  onConfirmPayment,
  onReleaseDelivery,
  onMarkDelivered,
  onCancelOrder,
  onOpenOrder,
  onRefresh,
}) {
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [activeMobileStatus, setActiveMobileStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Permission flags based on role & custom permissions
  const canConfirmPayment = canUser(currentUser, 'orders_confirm_payment');
  const canDispatchDriver = canUser(currentUser, 'orders_dispatch_driver');
  const canCancelOrderPerm = canUser(currentUser, 'orders_cancel');
  const [copiedOrderId, setCopiedOrderId] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      o.id.toString().includes(term) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
      (o.customer_phone && o.customer_phone.includes(term)) ||
      (o.delivery_address && o.delivery_address.toLowerCase().includes(term))
    );
  });

  const columns = [
    {
      id: 'pending_payment',
      title: 'Aguardando Pagamento',
      color: 'border-amber-400 bg-amber-50/50 text-amber-800',
      badge: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'paid',
      title: 'Pago & Em Separação',
      color: 'border-blue-400 bg-blue-50/50 text-blue-800',
      badge: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'ready_for_delivery',
      title: 'Pronto / Aguardando Motoboy',
      color: 'border-indigo-400 bg-indigo-50/50 text-indigo-800',
      badge: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'in_transit',
      title: 'Em Rota com Entregador',
      color: 'border-purple-400 bg-purple-50/50 text-purple-800',
      badge: 'bg-purple-100 text-purple-800',
    },
    {
      id: 'delivered',
      title: 'Entregue / Concluído',
      color: 'border-emerald-400 bg-emerald-50/50 text-emerald-800',
      badge: 'bg-emerald-100 text-emerald-800',
    },
  ];

  const handleOpenDispatch = (order) => {
    setDispatchModalOrder(order);
    const available = drivers.find((d) => d.status === 'available');
    setSelectedDriverId(available ? available.id : '');
  };

  const confirmDispatch = async () => {
    if (!dispatchModalOrder) return;
    await onReleaseDelivery(dispatchModalOrder.id, selectedDriverId ? Number(selectedDriverId) : null);
    setDispatchModalOrder(null);
  };

  return (
    <div className="space-y-5">
      {/* Top Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nº, cliente, telefone ou rua..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Atualizar lista de pedidos"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          )}

          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Kanban size={14} />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon size={14} />
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Status Filter Tabs (Visible on mobile for both views) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveMobileStatus('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeMobileStatus === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Todos ({filteredOrders.length})
        </button>
        {columns.map((col) => {
          const count = filteredOrders.filter((o) => o.status === col.id).length;
          const isActive = activeMobileStatus === col.id;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setActiveMobileStatus(col.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <span>{col.title.split('/')[0].split('&')[0].trim()}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 font-semibold'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {columns.map((col) => {
            const colOrders = filteredOrders.filter((o) => o.status === col.id);
            return (
              <div
                key={col.id}
                className={`bg-slate-100/80 rounded-2xl p-3 border border-slate-200/70 flex-col min-h-[300px] md:min-h-[500px] ${
                  activeMobileStatus !== 'all' && activeMobileStatus !== col.id ? 'hidden md:flex' : 'flex'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-700">{col.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.badge}`}>
                    {colOrders.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colOrders.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic">Nenhum pedido</div>
                  ) : (
                    colOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Order Header */}
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm text-slate-800">#{order.id}</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              R$ {Number(order.total).toFixed(2)}
                            </span>
                          </div>

                          {/* Customer Info */}
                          <div className="mt-2">
                            <p className="font-semibold text-xs text-slate-800">{order.customer_name || 'Cliente'}</p>
                            <p className="text-[10px] text-slate-400">📱 {order.customer_phone}</p>
                          </div>

                          {/* Payment Method Badge */}
                          <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                            {order.payment_method === 'CARD_ON_DELIVERY' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                💳 Cartão na Entrega
                              </span>
                            )}
                            {order.payment_method === 'CASH_ON_DELIVERY' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                💵 Dinheiro na Entrega
                              </span>
                            )}
                            {order.payment_method === 'CARD_PICKUP' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                💳 Cartão no Balcão
                              </span>
                            )}
                            {order.payment_method === 'CASH_PICKUP' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                💵 Dinheiro no Balcão
                              </span>
                            )}
                            {(!order.payment_method || order.payment_method === 'PIX') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                💠 Pix
                              </span>
                            )}
                          </div>

                          {/* Motoboy In-Person Payment Alert */}
                          {order.payment_method === 'CARD_ON_DELIVERY' && (
                            <div className="mt-1.5 p-1.5 bg-blue-50 rounded-lg border border-blue-200 text-[10px] text-blue-800 font-semibold flex items-center gap-1">
                              <span>🚨</span>
                              <span>Entregador deve levar maquininha</span>
                            </div>
                          )}
                          {order.payment_method === 'CASH_ON_DELIVERY' && (
                            <div className="mt-1.5 p-1.5 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-800 font-semibold flex items-center gap-1">
                              <span>💵</span>
                              <span>{order.notes || 'Receber em dinheiro'}</span>
                            </div>
                          )}

                          {/* Address */}
                          <div className="mt-1.5 text-[11px] text-slate-600 line-clamp-2">
                            📍 {order.delivery_type === 'pickup' ? '🏪 Retirada no Balcão' : order.delivery_address}
                          </div>

                          {/* Items Preview */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                            {order.items?.map((it, idx) => (
                              <div key={idx} className="text-[11px] text-slate-600 flex justify-between">
                                <span className="truncate pr-1">
                                  {it.quantity}x {it.product_name}
                                </span>
                                <span className="font-medium text-slate-700 shrink-0">
                                  R$ {Number(it.total_price).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Driver info if in transit */}
                        {order.driver_name && (
                          <div className="mt-2.5 p-1.5 rounded-lg bg-purple-50 text-purple-700 text-[10px] flex items-center gap-1.5">
                            <Bike size={12} />
                            <span className="font-semibold">{order.driver_name}</span>
                          </div>
                        )}

                        {/* Action Buttons strictly controlled by state & cashier permissions */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                          {order.status === 'pending_payment' && (
                            <>
                              {canConfirmPayment ? (
                                <button
                                  onClick={() => onConfirmPayment(order.id)}
                                  className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                                  title="Confirmar que o Pix caiu na conta bancária da farmácia"
                                >
                                  <DollarSign size={13} />
                                  Confirmar Pix Real
                                </button>
                              ) : (
                                <div
                                  className="w-full py-1.5 px-2 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 border border-slate-200"
                                  title="Apenas o Operador de Caixa tem permissão para confirmar Pix"
                                >
                                  <Lock size={12} className="text-slate-400" />
                                  <span>Aguardando Caixa Confirmar Pix</span>
                                </div>
                              )}
                              {order.pix_code && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(order.pix_code);
                                    setCopiedOrderId(order.id);
                                    setTimeout(() => setCopiedOrderId(null), 2500);
                                  }}
                                  className="w-full py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                                  title="Copiar código Pix Copia e Cola"
                                >
                                  {copiedOrderId === order.id ? (
                                    <Check size={11} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={11} className="text-slate-500" />
                                  )}
                                  <span>{copiedOrderId === order.id ? 'Pix Copiado! ✅' : 'Copiar Pix Copia e Cola'}</span>
                                </button>
                              )}
                            </>
                          )}

                          {order.status === 'paid' && (
                            canDispatchDriver ? (
                              <button
                                onClick={() => handleOpenDispatch(order)}
                                className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                              >
                                <Bike size={13} />
                                Liberar p/ Motoboy
                              </button>
                            ) : (
                              <div
                                className="w-full py-1.5 px-2 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 border border-slate-200"
                                title="Apenas o Operador de Caixa tem permissão para liberar para o motoboy"
                              >
                                <Lock size={12} className="text-slate-400" />
                                <span>Aguardando Caixa Despachar</span>
                              </div>
                            )
                          )}

                          {order.status === 'in_transit' && (
                            <button
                              onClick={() => onMarkDelivered(order.id)}
                              className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                            >
                              <CheckCircle size={13} />
                              Confirmar Entrega
                            </button>
                          )}

                          <div className="flex items-center justify-between gap-1 pt-1">
                            <button
                              onClick={() => onOpenOrder(order)}
                              className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1"
                            >
                              <Eye size={12} />
                              Detalhes
                            </button>

                            {order.status !== 'cancelled' && order.status !== 'delivered' && canCancelOrderPerm && (
                              <button
                                onClick={() => onCancelOrder(order.id)}
                                className="text-[11px] text-rose-500 hover:text-rose-700"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table & Mobile Card View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Mobile Order Cards View (sm:hidden) */}
          <div className="sm:hidden divide-y divide-slate-100">
            {filteredOrders
              .filter((o) => activeMobileStatus === 'all' || o.status === activeMobileStatus)
              .length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Nenhum pedido encontrado.
              </div>
            ) : (
              filteredOrders
                .filter((o) => activeMobileStatus === 'all' || o.status === activeMobileStatus)
                .map((order) => (
                  <div key={order.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-800">#{order.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {order.status}
                        </span>
                      </div>
                      <span className="font-bold text-sm text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                        R$ {Number(order.total).toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <p className="font-semibold text-xs text-slate-800">{order.customer_name || 'Cliente'}</p>
                      <p className="text-[10px] text-slate-400">📱 {order.customer_phone}</p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {order.payment_method === 'CARD_ON_DELIVERY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          💳 Cartão na Entrega (Maquininha)
                        </span>
                      )}
                      {order.payment_method === 'CASH_ON_DELIVERY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          💵 Dinheiro na Entrega
                        </span>
                      )}
                      {order.payment_method === 'CARD_PICKUP' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          💳 Cartão no Balcão
                        </span>
                      )}
                      {order.payment_method === 'CASH_PICKUP' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          💵 Dinheiro no Balcão
                        </span>
                      )}
                      {(!order.payment_method || order.payment_method === 'PIX') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          💠 Pix
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600">
                      📍 {order.delivery_type === 'pickup' ? '🏪 Retirada no Balcão' : order.delivery_address}
                    </p>

                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {order.items?.map((i) => `${i.quantity}x ${i.product_name}`).join(', ') || 'Sem itens'}
                    </div>

                    {order.driver_name && (
                      <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 text-[11px] flex items-center gap-1.5 font-medium">
                        <Bike size={13} />
                        <span>Entregador: {order.driver_name}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => onOpenOrder(order)}
                        className="p-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1"
                      >
                        <Eye size={14} />
                        Detalhes
                      </button>

                      <div className="flex items-center gap-1.5">
                        {order.status === 'pending_payment' && (
                          canConfirmPayment ? (
                            <button
                              onClick={() => onConfirmPayment(order.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                            >
                              Pix OK
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[11px] font-medium flex items-center gap-1 border border-slate-200" title="Apenas o Caixa pode confirmar Pix">
                              <Lock size={11} className="text-slate-400" /> Pix Pendente
                            </span>
                          )
                        )}
                        {order.status === 'paid' && (
                          canDispatchDriver ? (
                            <button
                              onClick={() => handleOpenDispatch(order)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                            >
                              Liberar Motoboy
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[11px] font-medium flex items-center gap-1 border border-slate-200" title="Apenas o Caixa pode liberar motoboy">
                              <Lock size={11} className="text-slate-400" /> Aguardando Caixa
                            </span>
                          )
                        )}
                        {order.status === 'in_transit' && (
                          <button
                            onClick={() => onMarkDelivered(order.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                          >
                            Entregue
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Desktop Table View (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Endereço</th>
                  <th className="py-3 px-4">Itens</th>
                  <th className="py-3 px-4">Frete</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Pagamento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Entregador</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">#{order.id}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{order.customer_name || 'Cliente'}</p>
                      <p className="text-[10px] text-slate-400">{order.customer_phone}</p>
                    </td>
                    <td className="py-3 px-4 max-w-[200px] truncate text-slate-600">
                      {order.delivery_type === 'pickup' ? 'Retirada no Balcão' : order.delivery_address}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {order.items?.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-slate-700">R$ {Number(order.delivery_fee).toFixed(2)}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">R$ {Number(order.total).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      {order.payment_method === 'CARD_ON_DELIVERY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          💳 Cartão Entrega
                        </span>
                      )}
                      {order.payment_method === 'CASH_ON_DELIVERY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          💵 Dinheiro Entrega
                        </span>
                      )}
                      {order.payment_method === 'CARD_PICKUP' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          💳 Cartão Balcão
                        </span>
                      )}
                      {order.payment_method === 'CASH_PICKUP' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          💵 Dinheiro Balcão
                        </span>
                      )}
                      {(!order.payment_method || order.payment_method === 'PIX') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          💠 Pix
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{order.driver_name || '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {order.status === 'pending_payment' && (
                          canConfirmPayment ? (
                            <button
                              onClick={() => onConfirmPayment(order.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                            >
                              Pix OK
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-medium flex items-center gap-1 border border-slate-200" title="Apenas o Caixa pode confirmar Pix">
                              <Lock size={10} className="text-slate-400" /> Caixa Pendente
                            </span>
                          )
                        )}
                        {order.status === 'paid' && (
                          canDispatchDriver ? (
                            <button
                              onClick={() => handleOpenDispatch(order)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold"
                            >
                              Liberar Motoboy
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-medium flex items-center gap-1 border border-slate-200" title="Apenas o Caixa pode liberar motoboy">
                              <Lock size={10} className="text-slate-400" /> Aguardando Caixa
                            </span>
                          )
                        )}
                        {order.status === 'in_transit' && (
                          <button
                            onClick={() => onMarkDelivered(order.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                          >
                            Entregue
                          </button>
                        )}
                        <button
                          onClick={() => onOpenOrder(order)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispatch to Driver Modal */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Bike size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Liberar Pedido #{dispatchModalOrder.id}</h3>
                <p className="text-xs text-slate-500">Acionamento automático do entregador no WhatsApp</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200/80">
              <p>
                <strong>Cliente:</strong> {dispatchModalOrder.customer_name} ({dispatchModalOrder.customer_phone})
              </p>
              <p>
                <strong>Endereço:</strong> {dispatchModalOrder.delivery_address}
              </p>
              <p>
                <strong>Valor Pago (Pix):</strong> R$ {Number(dispatchModalOrder.total).toFixed(2)} (Confirmado)
              </p>
              <p>
                <strong>Taxa do Entregador:</strong> R$ {Number(dispatchModalOrder.delivery_fee).toFixed(2)}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Selecione o Motoboy / Entregador:</label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">Selecione um entregador disponível...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.vehicle}) - Status: {d.status === 'available' ? '🟢 Disponível' : '🟡 ' + d.status}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                <AlertCircle size={12} className="text-indigo-600 shrink-0" />
                O entregador receberá a rota e os detalhes da entrega direto no WhatsApp dele!
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDispatch}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5"
              >
                <Bike size={14} />
                Confirmar e Disparar no WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
