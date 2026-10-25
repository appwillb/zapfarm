import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Factory,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Building,
  Phone,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  RotateCcw
} from 'lucide-react';
import { api } from '../api';

export default function BulkManufacturerModal({
  isOpen,
  onClose,
  tenantId,
  suppliers = [],
  initialManufacturer = null,
  onSaved
}) {
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unassigned' | 'assigned'
  const [selectedMfrs, setSelectedMfrs] = useState([]);
  const [targetSupplierId, setTargetSupplierId] = useState('');
  const [strategy, setStrategy] = useState('overwrite'); // 'overwrite' | 'only_empty'

  const loadManufacturers = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await api.getManufacturers(tenantId);
      if (Array.isArray(data)) {
        setManufacturers(data);
      }
    } catch (err) {
      console.error('Erro ao carregar lista de fabricantes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadManufacturers();
      const initMfr = initialManufacturer ? String(initialManufacturer).trim() : '';
      setSelectedMfrs(initMfr ? [initMfr] : []);
      setSearch(initMfr);
      setFilterMode('all');
      if (suppliers && suppliers.length > 0) {
        setTargetSupplierId(String(suppliers[0].id));
      }
    }
  }, [isOpen, tenantId, suppliers, initialManufacturer]);

  // Filtered list based on search and assignment status
  const filteredList = useMemo(() => {
    const term = search.trim().toLowerCase();
    return manufacturers.filter((m) => {
      const matchesSearch = !term || m.name.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      const hasSupplier = m.assigned_suppliers && m.assigned_suppliers.length > 0;
      if (filterMode === 'unassigned') return !hasSupplier;
      if (filterMode === 'assigned') return hasSupplier;
      return true;
    });
  }, [manufacturers, search, filterMode]);

  // Calculate total products represented by selected manufacturers
  const totalSelectedProducts = useMemo(() => {
    const set = new Set(selectedMfrs.map((s) => s.toUpperCase()));
    return manufacturers
      .filter((m) => set.has(m.name.toUpperCase()))
      .reduce((sum, m) => sum + (m.product_count || 0), 0);
  }, [manufacturers, selectedMfrs]);

  if (!isOpen) return null;

  const toggleSelect = (name) => {
    const trimmed = name.trim();
    if (selectedMfrs.some((m) => m.toUpperCase() === trimmed.toUpperCase())) {
      setSelectedMfrs(selectedMfrs.filter((m) => m.toUpperCase() !== trimmed.toUpperCase()));
    } else {
      setSelectedMfrs([...selectedMfrs, trimmed]);
    }
  };

  const handleSelectAllFiltered = () => {
    const names = filteredList.map((m) => m.name.trim());
    const combined = Array.from(new Set([...selectedMfrs, ...names]));
    setSelectedMfrs(combined);
  };

  const handleDeselectAllFiltered = () => {
    const filteredSet = new Set(filteredList.map((m) => m.name.trim().toUpperCase()));
    setSelectedMfrs(selectedMfrs.filter((m) => !filteredSet.has(m.trim().toUpperCase())));
  };

  const handleClearAll = () => {
    setSelectedMfrs([]);
  };

  const handleBind = async () => {
    if (!targetSupplierId) {
      alert('Selecione um vendedor / representante para receber os fabricantes.');
      return;
    }
    if (selectedMfrs.length === 0) {
      alert('Selecione pelo menos um fabricante para vincular.');
      return;
    }

    const targetSupplier = suppliers.find((s) => String(s.id) === String(targetSupplierId));
    const confirmMsg = `Confirma vincular ${selectedMfrs.length} fabricante(s) (${totalSelectedProducts} produtos) ao vendedor "${targetSupplier?.name}"?\n\nEstratégia: ${
      strategy === 'overwrite' ? 'Tornar Vendedor Principal' : 'Apenas onde não houver vendedor'
    }`;

    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const res = await api.bindSupplierManufacturers({
        tenant_id: tenantId,
        supplier_id: parseInt(targetSupplierId, 10),
        manufacturers: selectedMfrs,
        strategy
      });

      alert(
        `✅ Sucesso!\n\n${res.affected || totalSelectedProducts} medicamentos foram vinculados a ${
          targetSupplier?.name
        } com sucesso!`
      );

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      alert('Erro ao vincular fabricantes: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const targetSupplier = suppliers.find((s) => String(s.id) === String(targetSupplierId));

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl flex flex-col max-h-[92vh] border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Factory size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                <span>Vincular Fabricantes em Massa</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                  {manufacturers.length} laboratórios
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Selecione vários laboratórios de uma vez para vincular ao WhatsApp do vendedor correspondente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search, Filter Tabs & Batch Buttons */}
        <div className="py-3 space-y-3 shrink-0 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por laboratório (ex: CIMED, EMS, TEUTO, PRATI, EUROFARMA)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({manufacturers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unassigned')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filterMode === 'unassigned'
                    ? 'bg-white text-amber-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sem Vendedor ({manufacturers.filter((m) => !m.assigned_suppliers?.length).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('assigned')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filterMode === 'assigned'
                    ? 'bg-white text-emerald-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Com Vendedor ({manufacturers.filter((m) => m.assigned_suppliers?.length > 0).length})
              </button>
            </div>
          </div>

          {/* Selection counter & bulk action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs">
                {selectedMfrs.length} selecionado(s)
              </span>
              {totalSelectedProducts > 0 && (
                <span className="text-slate-600 font-medium text-xs">
                  ({totalSelectedProducts} produtos no catálogo)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Marcar todos os filtrados ({filteredList.length})
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Desmarcar filtrados
              </button>
              {selectedMfrs.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    Limpar tudo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Grid/List of Manufacturers */}
        <div className="flex-1 overflow-y-auto py-2.5 space-y-1.5 min-h-[220px]">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Carregando lista completa de laboratórios...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Nenhum fabricante encontrado para os filtros atuais.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredList.map((m) => {
                const isSelected = selectedMfrs.some((s) => s.toUpperCase() === m.name.toUpperCase());
                const hasAssigned = m.assigned_suppliers && m.assigned_suppliers.length > 0;

                return (
                  <div
                    key={m.name}
                    onClick={() => toggleSelect(m.name)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 text-xs ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 shadow-xs ring-1 ring-indigo-200'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-indigo-600 focus:ring-0 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className={`font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                          {m.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {m.product_count} {m.product_count === 1 ? 'medicamento' : 'medicamentos'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {hasAssigned ? (
                        <div className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md max-w-[150px] truncate" title={`Vinculado a: ${m.assigned_suppliers.map((s) => s.name).join(', ')}`}>
                          {m.assigned_suppliers.map((s) => s.name).join(', ')}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          Sem vendedor
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignment Action Bar at Footer */}
        <div className="pt-4 border-t border-slate-100 bg-slate-50/80 -mx-5 sm:-mx-7 -mb-5 sm:-mb-7 p-5 sm:p-6 rounded-b-3xl space-y-3.5 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Target Supplier Selector */}
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <UserCheck size={14} className="text-emerald-600" />
                <span>Atribuir os {selectedMfrs.length} laboratórios selecionados ao Vendedor:</span>
              </label>

              {suppliers.length === 0 ? (
                <div className="p-2.5 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200">
                  Nenhum vendedor cadastrado ainda. Cadastre um vendedor primeiro na aba "Vendedores & Distribuidoras".
                </div>
              ) : (
                <select
                  value={targetSupplierId}
                  onChange={(e) => setTargetSupplierId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.company ? `(${s.company})` : ''} - WhatsApp: {s.phone || 'Sem número'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Strategy Radio */}
            <div className="sm:w-72 bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="massStrategy"
                  value="overwrite"
                  checked={strategy === 'overwrite'}
                  onChange={() => setStrategy('overwrite')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>Tornar Vendedor Principal (Recomendado)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="massStrategy"
                  value="only_empty"
                  checked={strategy === 'only_empty'}
                  onChange={() => setStrategy('only_empty')}
                  className="text-indigo-600 focus:ring-0"
                />
                <span>Apenas onde ainda não há vendedor</span>
              </label>
            </div>
          </div>

          {/* Action Confirmation Buttons */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-500 hidden sm:block">
              {selectedMfrs.length > 0 && targetSupplier ? (
                <span>
                  O robô ZapFarm notificará <strong>{targetSupplier.name}</strong> quando qualquer um desses{' '}
                  <strong>{totalSelectedProducts} medicamentos</strong> estiver com estoque baixo.
                </span>
              ) : (
                <span>Selecione os laboratórios acima e escolha o vendedor.</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBind}
                disabled={submitting || selectedMfrs.length === 0 || !targetSupplierId}
                className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={16} />
                {submitting
                  ? 'Vinculando...'
                  : `Vincular ${selectedMfrs.length} Fabricante(s) ao Vendedor`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
