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
  AlertCircle,
  Factory,
  Sparkles,
  BarChart3,
  Send,
  X
} from 'lucide-react';
import { api } from '../api';

export default function SuppliersTab({
  tenantId,
  products = [],
  whatsappStatus,
  onNavigateTab,
  onOpenAddSupplier,
  onOpenEditSupplier,
  onFilterProductsBySupplier,
  onRefresh,
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [testingId, setTestingId] = useState(null);
  const [reportSupplier, setReportSupplier] = useState(null);
  const [reportPeriod, setReportPeriod] = useState(30);
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const handleOpenReport = async (supplier) => {
    setReportSupplier(supplier);
    setLoadingReport(true);
    setReportData(null);
    try {
      const data = await api.getSupplierSalesReport(supplier.id, reportPeriod);
      setReportData(data);
    } catch (err) {
      alert('Erro ao carregar relatório de vendas: ' + err.message);
    } finally {
      setLoadingReport(false);
    }
  };

  const handlePeriodChange = async (days) => {
    setReportPeriod(days);
    if (!reportSupplier) return;
    setLoadingReport(true);
    try {
      const data = await api.getSupplierSalesReport(reportSupplier.id, days);
      setReportData(data);
    } catch (err) {
      alert('Erro ao filtrar relatório: ' + err.message);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleSendReportWhatsApp = async () => {
    if (!reportSupplier) return;
    setSendingReport(true);
    try {
      const res = await api.sendSupplierSalesReport(reportSupplier.id, reportPeriod);
      if (res.success) {
        alert(`✅ Relatório de ${reportPeriod} dias enviado com sucesso no WhatsApp de ${reportSupplier.name}!`);
      } else {
        alert(res.error || 'Erro ao enviar relatório');
      }
    } catch (err) {
      alert('Erro ao enviar relatório via WhatsApp: ' + err.message);
    } finally {
      setSendingReport(false);
    }
  };

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
      alert('Este vendedor não possui número de WhatsApp cadastrado.');
      return;
    }

    if (whatsappStatus && whatsappStatus.status !== 'connected') {
      if (
        window.confirm(
          `⚠️ O WhatsApp da farmácia não está conectado no momento!\n\nPara que a mensagem chegue de verdade no celular de ${supplier.name}, é necessário ler o QR Code na aba "Conexão WhatsApp".\n\nDeseja ir para a tela de conexão agora?`
        )
      ) {
        if (onNavigateTab) onNavigateTab('whatsapp');
        return;
      }
    }

    try {
      setTestingId(supplier.id);
      const res = await api.testSupplierWhatsApp(supplier.id, 'Farmacêutico Responsável');
      if (res.success) {
        alert(
          `✅ Mensagem teste entregue com sucesso no WhatsApp de ${supplier.name} (${supplier.phone})!\n\nVerifique a notificação no celular dele.`
        );
      } else {
        alert(`⚠️ ${res.error || 'Erro ao enviar notificação teste.'}`);
      }
    } catch (err) {
      alert('Erro ao disparar teste: ' + err.message);
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
    const mfrsStr = Array.isArray(s.manufacturers) ? s.manufacturers.join(' ').toLowerCase() : '';
    return (
      s.name.toLowerCase().includes(term) ||
      (s.company && s.company.toLowerCase().includes(term)) ||
      (s.phone && s.phone.includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term)) ||
      (s.notes && s.notes.toLowerCase().includes(term)) ||
      mfrsStr.includes(term)
    );
  });

  const totalLinkedProducts = products.filter((p) => p.supplier_id).length;

  const totalUniqueManufacturersRepresented = new Set(
    suppliers.flatMap((s) => (Array.isArray(s.manufacturers) ? s.manufacturers : []))
  ).size;

  return (
    <div className="space-y-5">
      {/* WhatsApp Disconnected Alert Banner */}
      {whatsappStatus?.status !== 'connected' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-xs sm:text-sm">
                WhatsApp da Farmácia Desconectado
              </h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Para que os alertas de reposição e testes cheguem ao celular dos vendedores, escaneie o QR Code com o WhatsApp da farmácia.
              </p>
            </div>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('whatsapp')}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs"
            >
              Conectar WhatsApp Agora
            </button>
          )}
        </div>
      )}

      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Vendedores & Reps</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{suppliers.length}</p>
            <p className="text-[11px] text-slate-400">Representantes ativos</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Factory size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Laboratórios Vinculados</p>
            <p className="text-2xl font-bold text-indigo-700 mt-0.5">
              {totalUniqueManufacturersRepresented}
            </p>
            <p className="text-[11px] text-slate-400">Fabricantes com vendedor direto</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Phone size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">WhatsApp p/ Cotação</p>
            <p className="text-2xl font-bold text-teal-700 mt-0.5">
              {suppliers.filter((s) => s.phone && s.active).length}
            </p>
            <p className="text-[11px] text-slate-400">Robô envia pedido direto</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Pill size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Medicamentos Cobertos</p>
            <p className="text-2xl font-bold text-sky-700 mt-0.5">{totalLinkedProducts}</p>
            <p className="text-[11px] text-slate-400">Com vendedor automático</p>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, laboratório, distribuidora..."
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
              const mfrs = Array.isArray(s.manufacturers) ? s.manufacturers : [];

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

                  {/* Manufacturers tags on mobile */}
                  {mfrs.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {mfrs.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-semibold"
                        >
                          {m}
                        </span>
                      ))}
                      {mfrs.length > 3 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px]">
                          +{mfrs.length - 3} mais
                        </span>
                      )}
                    </div>
                  )}

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
                    {s.phone && (
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
                <th className="py-3 px-4">Representante / Vendedor</th>
                <th className="py-3 px-4">Distribuidora</th>
                <th className="py-3 px-4">Fabricantes / Laboratórios</th>
                <th className="py-3 px-4">WhatsApp (Robô ZapFarm)</th>
                <th className="py-3 px-4">Medicamentos</th>
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
                  const mfrs = Array.isArray(s.manufacturers) ? s.manufacturers : [];

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
                              {s.active ? '🟢 Ativo para Cotações' : '🔴 Inativo'}
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
                          <span className="text-slate-400 italic">Multimarcas</span>
                        )}
                      </td>

                      {/* Manufacturers column */}
                      <td className="py-3.5 px-4">
                        {mfrs.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1 max-w-xs">
                            {mfrs.slice(0, 2).map((m) => (
                              <span
                                key={m}
                                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold"
                              >
                                {m}
                              </span>
                            ))}
                            {mfrs.length > 2 && (
                              <button
                                type="button"
                                onClick={() => onOpenEditSupplier(s)}
                                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-[10px] font-semibold"
                                title={mfrs.join(', ')}
                              >
                                +{mfrs.length - 2} mais
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenEditSupplier(s)}
                            className="text-[11px] text-slate-400 hover:text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            + Vincular laboratórios
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {s.phone ? (
                          <a
                            href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:underline font-semibold"
                            title="Abrir conversa no WhatsApp"
                          >
                            <Phone size={12} className="text-emerald-500" />
                            {s.phone}
                            <ExternalLink size={10} className="text-slate-400 ml-0.5" />
                          </a>
                        ) : (
                          <span className="text-rose-500 italic">Sem WhatsApp</span>
                        )}
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
                          <button
                            type="button"
                            onClick={() => handleOpenReport(s)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Ver Relatório de Vendas e Giro deste Fornecedor"
                          >
                            <BarChart3 size={13} className="text-indigo-600" />
                            <span className="hidden xl:inline">Relatório</span>
                          </button>

                          {s.phone && (
                            <button
                              type="button"
                              onClick={() => handleTestWhatsApp(s)}
                              disabled={testingId === s.id}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Disparar cotação/alerta de teste para este vendedor via WhatsApp"
                            >
                              <Bell size={13} className={testingId === s.id ? 'animate-bounce' : ''} />
                              <span className="hidden lg:inline">
                                {testingId === s.id ? 'Enviando...' : 'Testar WhatsApp'}
                              </span>
                            </button>
                          )}

                          <button
                            onClick={() => onOpenEditSupplier(s)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar Dados e Fabricantes do Vendedor"
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

      {/* Modal de Relatório de Vendas e Giro para a Distribuidora */}
      {reportSupplier && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Relatório de Vendas & Giro: {reportSupplier.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {reportSupplier.company ? `Distribuidora: ${reportSupplier.company} • ` : ''}WhatsApp: {reportSupplier.phone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportSupplier(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter by Period (7, 15, 30, 90 days) */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[7, 15, 30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handlePeriodChange(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriod === d
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {d === 7 ? 'Últimos 7 dias (Semanal)' : d === 30 ? 'Últimos 30 dias (Mensal)' : `${d} dias`}
                  </button>
                ))}
              </div>

              {reportSupplier.phone && (
                <button
                  type="button"
                  onClick={handleSendReportWhatsApp}
                  disabled={sendingReport}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                  title="Enviar resumo formatado direto no WhatsApp do vendedor"
                >
                  <Send size={13} />
                  <span>{sendingReport ? 'Enviando...' : 'Enviar Relatório no WhatsApp'}</span>
                </button>
              )}
            </div>

            {/* Summary Cards */}
            {reportData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 block font-medium">Produtos Vinculados</span>
                  <span className="text-lg font-black text-slate-800">{reportData.summary.totalProducts}</span>
                </div>
                <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100">
                  <span className="text-[11px] text-indigo-700 block font-medium">Unidades Vendidas</span>
                  <span className="text-lg font-black text-indigo-900">{reportData.summary.totalUnitsSold}</span>
                </div>
                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                  <span className="text-[11px] text-emerald-700 block font-medium">Faturamento Giro</span>
                  <span className="text-lg font-black text-emerald-900">R$ {reportData.summary.totalRevenue.toFixed(2)}</span>
                </div>
                <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100">
                  <span className="text-[11px] text-amber-700 block font-medium">Precisam Reposição</span>
                  <span className="text-lg font-black text-amber-900">{reportData.summary.itemsNeedingRestock}</span>
                </div>
              </div>
            )}

            {/* Products Table */}
            {loadingReport ? (
              <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-indigo-600" />
                <span>Calculando vendas e estoque...</span>
              </div>
            ) : reportData && reportData.items.length > 0 ? (
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2.5">Medicamento</th>
                      <th className="p-2.5">Fabricante</th>
                      <th className="p-2.5 text-center">Estoque Atual</th>
                      <th className="p-2.5 text-center">Qtd. Vendida</th>
                      <th className="p-2.5 text-right">Faturamento</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium text-slate-800">{item.name}</td>
                        <td className="p-2.5 text-slate-500">{item.manufacturer || '—'}</td>
                        <td className="p-2.5 text-center font-bold text-slate-700">{item.stock_quantity} un.</td>
                        <td className="p-2.5 text-center font-bold text-indigo-700">
                          {item.units_sold > 0 ? `${item.units_sold} un.` : '0'}
                        </td>
                        <td className="p-2.5 text-right font-medium text-slate-700">R$ {item.revenue_sold.toFixed(2)}</td>
                        <td className="p-2.5 text-center">
                          {item.is_low_stock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              ⚠️ Repor ({item.suggested_restock} un)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum produto cadastrado para este fornecedor.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReportSupplier(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
