import React, { useState } from 'react';
import { Boxes, AlertTriangle, Calendar, Layers, CheckCircle, Bell, User } from 'lucide-react';
import { api } from '../api';

export default function InventoryTab({ products, currentUser, onRefresh }) {
  const [notifyingId, setNotifyingId] = useState(null);

  const criticalItems = products.filter((p) => p.stock_quantity <= p.min_stock);
  const totalPhysicalStock = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const totalReserved = products.reduce((sum, p) => sum + (p.reserved_quantity || 0), 0);

  const handleNotifySupplier = async (product) => {
    if (!product.supplier_id) {
      alert(`O medicamento "${product.name}" não possui um vendedor vinculado. Vá na aba Medicamentos para vinculá-lo.`);
      return;
    }

    try {
      setNotifyingId(product.id);
      const res = await api.notifySupplierLowStock(product.id, currentUser?.name || 'Farmacêutico');
      if (res.success) {
        alert(`✅ Pedido de reposição enviado para o vendedor ${res.supplier?.name} (${res.supplier?.phone}) via WhatsApp!`);
        if (onRefresh) onRefresh();
      } else {
        alert(res.error || 'Erro ao avisar vendedor');
      }
    } catch (err) {
      alert('Erro ao enviar alerta ao vendedor: ' + err.message);
    } finally {
      setNotifyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Saldo Físico Geral</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalPhysicalStock} unidades</p>
          <p className="text-xs text-slate-400 mt-1">Estoque total nas prateleiras</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Unidades Reservadas</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalReserved} unidades</p>
          <p className="text-xs text-slate-400 mt-1">Bloqueadas por pedidos em andamento</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Itens em Nível Crítico</span>
          <p className="text-2xl font-bold text-rose-600 mt-1">{criticalItems.length} medicamentos</p>
          <p className="text-xs text-slate-400 mt-1">Abaixo do estoque mínimo configurado</p>
        </div>
      </div>

      {/* Critical Stock List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-rose-600" />
          <h3 className="font-bold text-slate-800 text-sm">Controle de Reposição Imediata & Vendedores</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Medicamento</th>
                <th className="py-2.5 px-3">Vendedor / Rep.</th>
                <th className="py-2.5 px-3">Estoque Atual</th>
                <th className="py-2.5 px-3">Estoque Mínimo</th>
                <th className="py-2.5 px-3">Reservado</th>
                <th className="py-2.5 px-3">Disponível p/ Venda</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Ação Reposição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const available = p.stock_quantity - (p.reserved_quantity || 0);
                const isCritical = p.stock_quantity <= p.min_stock;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-slate-500">{p.dosage} &bull; {p.presentation}</p>
                    </td>
                    <td className="py-3 px-3">
                      {p.supplier_name ? (
                        <div>
                          <p className="font-semibold text-slate-700">👤 {p.supplier_name}</p>
                          {p.supplier_company && (
                            <p className="text-[10px] text-slate-400">{p.supplier_company}</p>
                          )}
                          {p.supplier_phone && (
                            <p className="text-[10px] text-emerald-600 font-mono">📱 {p.supplier_phone}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Sem vendedor</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700">{p.stock_quantity} un.</td>
                    <td className="py-3 px-3 text-slate-500">{p.min_stock} un.</td>
                    <td className="py-3 px-3 text-amber-600 font-medium">{p.reserved_quantity || 0} un.</td>
                    <td className="py-3 px-3 font-bold text-slate-800">{available} un.</td>
                    <td className="py-3 px-3">
                      {isCritical ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                          Reposição Necessária
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          Regular
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isCritical && (
                        <button
                          type="button"
                          onClick={() => handleNotifySupplier(p)}
                          disabled={notifyingId === p.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs ${
                            p.supplier_id
                              ? 'bg-amber-500 hover:bg-amber-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                          title={p.supplier_id ? `Enviar mensagem WhatsApp para ${p.supplier_name}` : 'Sem vendedor vinculado'}
                        >
                          <Bell size={13} className={notifyingId === p.id ? 'animate-bounce' : ''} />
                          {notifyingId === p.id ? 'Enviando...' : 'Avisar Vendedor'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
