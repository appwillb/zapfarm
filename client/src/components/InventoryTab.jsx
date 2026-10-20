import React, { useState, useMemo } from 'react';
import { Boxes, AlertTriangle, Calendar, Layers, CheckCircle, Bell, User, Search, Filter } from 'lucide-react';
import { api } from '../api';

export default function InventoryTab({ products, currentUser, onRefresh }) {
  const [notifyingId, setNotifyingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('critical'); // 'critical' | 'all' | 'regular'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const criticalItems = useMemo(() => products.filter((p) => p.stock_quantity <= p.min_stock), [products]);
  const totalPhysicalStock = useMemo(() => products.reduce((sum, p) => sum + p.stock_quantity, 0), [products]);
  const totalReserved = useMemo(() => products.reduce((sum, p) => sum + (p.reserved_quantity || 0), 0), [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.includes(term)) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(term)) ||
        (p.supplier_company && p.supplier_company.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      const isCritical = p.stock_quantity <= p.min_stock;
      if (statusFilter === 'critical') return isCritical;
      if (statusFilter === 'regular') return !isCritical;
      return true; // 'all'
    });
  }, [products, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredProducts, currentPage, pageSize]);

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
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600" />
            <h3 className="font-bold text-slate-800 text-sm">Controle de Reposição Imediata & Vendedores</h3>
          </div>

          {/* Filtros rápidos e busca */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por nome, EAN ou rep..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('critical');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === 'critical'
                    ? 'bg-white text-rose-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🚨 Críticos ({criticalItems.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({products.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('regular');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === 'regular'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✅ Regulares
              </button>
            </div>
          </div>
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
                <th className="py-2.5 px-3 text-right sticky right-0 bg-slate-50 shadow-[-5px_0_10px_rgba(0,0,0,0.03)] z-10">Ação Reposição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum medicamento encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
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
                    <td className="py-3 px-3 text-right sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-5px_0_10px_rgba(0,0,0,0.03)] z-10">
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
              }))}
            </tbody>
          </table>
        </div>

        {/* Paginação do Estoque */}
        {filteredProducts.length > 0 && (
          <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Mostrando <b>{(currentPage - 1) * pageSize + 1}</b> a <b>{Math.min(currentPage * pageSize, filteredProducts.length)}</b> de <b>{filteredProducts.length}</b> itens
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium ml-2"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                Anterior
              </button>

              <span className="px-3 py-1 font-bold text-slate-800">
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
