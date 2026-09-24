import React from 'react';
import { Boxes, AlertTriangle, Calendar, Layers, CheckCircle } from 'lucide-react';

export default function InventoryTab({ products }) {
  const criticalItems = products.filter((p) => p.stock_quantity <= p.min_stock);
  const totalPhysicalStock = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const totalReserved = products.reduce((sum, p) => sum + (p.reserved_quantity || 0), 0);

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
          <h3 className="font-bold text-slate-800 text-sm">Controle de Reposição Imediata</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Medicamento</th>
                <th className="py-2.5 px-3">Estoque Atual</th>
                <th className="py-2.5 px-3">Estoque Mínimo</th>
                <th className="py-2.5 px-3">Reservado</th>
                <th className="py-2.5 px-3">Disponível p/ Venda</th>
                <th className="py-2.5 px-3">Status</th>
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
