import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Building,
  Phone,
  Mail,
  Edit,
  Trash2,
  Bell,
  RefreshCw,
  ExternalLink,
  Pill,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';

export default function SuppliersTab({
  tenantId,
  products = [],
  onOpenAddSupplier,
  onOpenEditSupplier,
  onFilterProductsBySupplier,
  onRefresh,
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [testingId, setTestingId] = useState(null);

  const loadSuppliers = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await api.getSuppliers(tenantId);
      if (Array.isArray(data)) setSuppliers(data);
    } catch (err) {
      console.error('Erro ao carregar vendedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [tenantId]);

  const handleRefresh = async () => {
    await loadSuppliers();
    if (onRefresh) onRefresh();
  };

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Tem certeza que deseja desativar o vendedor "${supplier.name}"?`)) return;
    try {
      await api.deleteSupplier(supplier.id);
      await loadSuppliers();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Erro ao desativar vendedor: ' + err.message);
    }
  };

  const handleTestWhatsApp = async (supplier) => {
    if (!supplier.phone) {
      alert('Este vendedor não possui telefone cadastrado.');
      return;
    }

    // Find any product from this supplier or send a general test
    const supplierProds = products.filter((p) => p.supplier_id === supplier.id);
    const targetProd = supplierProds[0];

    if (!targetProd) {
      alert(
        `Para testar o alerta automático, primeiro vincule pelo menos um medicamento a ${supplier.name} na aba de Produtos ou Importação CSV.`
      );
      return;
    }

    try {
      setTestingId(supplier.id);
      const res = await api.notifySupplierLowStock(targetProd.id, 'Teste do Sistema ZapFarm');
      if (res.success) {
        alert(`✅ Notificação teste enviada com sucesso para o WhatsApp de ${supplier.name} (${supplier.phone})!`);
      } else {
        alert(res.error || 'Erro ao enviar notificação teste.');
      }
    } catch (err) {
      alert('Erro ao enviar teste: ' + err.message);
    } finally {
      setTestingId(null);
    }
  };

  // Count products per supplier
  const getProductCount = (supplierId) => {
    return products.filter((p) => p.supplier_id === supplierId).length;
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.company && s.company.toLowerCase().includes(term)) ||
      (s.phone && s.phone.includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term)) ||
      (s.notes && s.notes.toLowerCase().includes(term))
    );
  });

  const totalLinkedProducts = products.filter((p) => p.supplier_id).length;

  return (
    <div className="space-y-5">
      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Vendedores & Reps</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{suppliers.length}</p>
            <p className="text-[11px] text-slate-400">Representantes cadastrados</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Phone size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">WhatsApp Ativo p/ Alertas</p>
            <p className="text-2xl font-bold text-teal-700 mt-0.5">
              {suppliers.filter((s) => s.phone && s.active).length}
            </p>
            <p className="text-[11px] text-slate-400">Notificação automática ativada</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Pill size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Medicamentos Vinculados</p>
            <p className="text-2xl font-bold text-indigo-700 mt-0.5">{totalLinkedProducts}</p>
            <p className="text-[11px] text-slate-400">Itens com vendedor definido</p>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, distribuidora, WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-xs"
            title="Atualizar lista"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
            <span className="hidden sm:inline ml-1.5">{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>

          <button
            onClick={onOpenAddSupplier}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <Plus size={14} />
            Novo Vendedor / Rep.
          </button>
        </div>
      </div>

      {/* Suppliers Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Mobile View */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filteredSuppliers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nenhum vendedor ou representante cadastrado.
            </div>
          ) : (
            filteredSuppliers.map((s) => {
              const count = getProductCount(s.id);
              return (
                <div key={s.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <UserCheck size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs leading-tight">{s.name}</h4>
                        {s.company && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building size={11} className="text-slate-400" />
                            {s.company}
                          </p>
                        )}
                        {s.email && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail size={10} />
                            {s.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                      {count} {count === 1 ? 'remédio' : 'remédios'}
                    </span>
                  </div>

                  {s.phone && (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <a
                        href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 font-mono font-semibold hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <Phone size={12} className="text-emerald-600" />
                        {s.phone}
                        <ExternalLink size={10} className="text-slate-400" />
                      </a>

                      <span className="text-[10px] text-slate-500">
                        {s.active ? '🟢 Ativo' : '🔴 Inativo'}
                      </span>
                    </div>
                  )}

                  {s.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl italic">
                      "{s.notes}"
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {count > 0 && (
                      <button
                        type="button"
                        onClick={() => handleTestWhatsApp(s)}
                        disabled={testingId === s.id}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Enviar mensagem teste no WhatsApp"
                      >
                        <Bell size={13} className={testingId === s.id ? 'animate-bounce' : ''} />
                        {testingId === s.id ? 'Enviando...' : 'Testar Alerta'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenEditSupplier(s)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Edit size={13} />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 size={13} />
                      Desativar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Representante / Fornecedor</th>
                <th className="py-3 px-4">Distribuidora / Laboratório</th>
                <th className="py-3 px-4">WhatsApp (Robô ZapFarm)</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Itens Fornecidos</th>
                <th className="py-3 px-4">Observações</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum representante encontrado para essa busca.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => {
                  const count = getProductCount(s.id);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <UserCheck size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{s.name}</p>
                            <span className="text-[10px] text-emerald-600 font-medium">
                              {s.active ? '🟢 Ativo para Alertas' : '🔴 Inativo'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {s.company ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Building size={12} className="text-slate-400" />
                            {s.company}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Geral / Multimarcas</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {s.phone ? (
                          <a
                            href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:underline font-semibold"
                            title="Abrir WhatsApp"
                          >
                            <Phone size={12} className="text-emerald-500" />
                            {s.phone}
                            <ExternalLink size={10} className="text-slate-400 ml-0.5" />
                          </a>
                        ) : (
                          <span className="text-rose-500 italic">Sem WhatsApp</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {s.email || <span className="text-slate-400 italic">—</span>}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full font-bold text-[11px] inline-flex items-center gap-1">
                          <Pill size={11} className="text-emerald-600" />
                          {count} {count === 1 ? 'medicamento' : 'medicamentos'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {s.notes || <span className="text-slate-400 italic">—</span>}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => handleTestWhatsApp(s)}
                              disabled={testingId === s.id}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Disparar cotação/alerta de teste para este vendedor via WhatsApp"
                            >
                              <Bell size={13} className={testingId === s.id ? 'animate-bounce' : ''} />
                              <span className="hidden lg:inline">{testingId === s.id ? 'Enviando...' : 'Testar WhatsApp'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => onOpenEditSupplier(s)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar Dados do Vendedor"
                          >
                            <Edit size={14} />
                          </button>

                          <button
                            onClick={() => handleDelete(s)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Desativar Vendedor"
                          >
                            <Trash2 size={14} />
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
    </div>
  );
}
