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
} from 'lucide-react';

export default function OrdersTab({
  orders,
  drivers,
  onConfirmPayment,
  onReleaseDelivery,
  onMarkDelivered,
  onCancelOrder,
  onOpenOrder,
  onRefresh,
}) {
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);

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
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Atualizar lista de pedidos"
            >
              <RefreshCw size={13} className="text-slate-500" />
              <span>Atualizar</span>
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

      {/* Kanban View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {columns.map((col) => {
            const colOrders = filteredOrders.filter((o) => o.status === col.id);
            return (
              <div key={col.id} className="bg-slate-100/80 rounded-2xl p-3 border border-slate-200/70 flex flex-col min-h-[500px]">
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

                        {/* Action Buttons strictly controlled by state */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                          {order.status === 'pending_payment' && (
                            <button
                              onClick={() => onConfirmPayment(order.id)}
                              className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                            >
                              <DollarSign size={13} />
                              Confirmar Pix Real
                            </button>
                          )}

                          {order.status === 'paid' && (
                            <button
                              onClick={() => handleOpenDispatch(order)}
                              className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                            >
                              <Bike size={13} />
                              Liberar p/ Motoboy
                            </button>
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

                            {order.status !== 'cancelled' && order.status !== 'delivered' && (
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
        /* Detailed Table View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Endereço</th>
                  <th className="py-3 px-4">Itens</th>
                  <th className="py-3 px-4">Frete</th>
                  <th className="py-3 px-4">Total</th>
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{order.driver_name || '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {order.status === 'pending_payment' && (
                          <button
                            onClick={() => onConfirmPayment(order.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                          >
                            Pix OK
                          </button>
                        )}
                        {order.status === 'paid' && (
                          <button
                            onClick={() => handleOpenDispatch(order)}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold"
                          >
                            Liberar Motoboy
                          </button>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
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
