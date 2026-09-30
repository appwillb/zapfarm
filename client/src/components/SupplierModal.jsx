import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  Save,
  Phone,
  Building,
  Mail,
  FileText,
  CheckCircle2,
  Factory,
  Search,
  Sparkles,
  Info,
  Check,
  Plus
} from 'lucide-react';
import { api } from '../api';

export default function SupplierModal({ isOpen, onClose, supplier, tenantId, onSaved }) {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    notes: '',
    active: 1,
  });

  const [allManufacturers, setAllManufacturers] = useState([]);
  const [selectedManufacturers, setSelectedManufacturers] = useState([]);
  const [bindingStrategy, setBindingStrategy] = useState('overwrite');
  const [mfrSearch, setMfrSearch] = useState('');
  const [loadingMfrs, setLoadingMfrs] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (tenantId) {
      setLoadingMfrs(true);
      api.getManufacturers(tenantId)
        .then((data) => {
          if (Array.isArray(data)) setAllManufacturers(data);
        })
        .catch((err) => console.error('Erro ao carregar fabricantes:', err))
        .finally(() => setLoadingMfrs(false));
    }

    if (supplier) {
      setFormData({
        name: supplier.name || '',
        company: supplier.company || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        notes: supplier.notes || '',
        active: supplier.active ?? 1,
      });

      let initMfrs = [];
      if (Array.isArray(supplier.manufacturers)) {
        initMfrs = supplier.manufacturers;
      } else if (typeof supplier.manufacturers === 'string') {
        try {
          initMfrs = JSON.parse(supplier.manufacturers);
        } catch (e) {
          initMfrs = supplier.manufacturers.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      setSelectedManufacturers(initMfrs || []);
      setBindingStrategy('overwrite');
    } else {
      setFormData({
        name: '',
        company: '',
        phone: '',
        email: '',
        notes: '',
        active: 1,
      });
      setSelectedManufacturers([]);
      setBindingStrategy('overwrite');
    }
    setMfrSearch('');
  }, [supplier, isOpen, tenantId]);

  if (!isOpen) return null;

  const toggleManufacturer = (name) => {
    const trimmed = name.trim();
    if (selectedManufacturers.includes(trimmed)) {
      setSelectedManufacturers(selectedManufacturers.filter((m) => m !== trimmed));
    } else {
      setSelectedManufacturers([...selectedManufacturers, trimmed]);
    }
  };

  const handleAddCustomManufacturer = () => {
    const trimmed = mfrSearch.trim().toUpperCase();
    if (trimmed && !selectedManufacturers.includes(trimmed)) {
      setSelectedManufacturers([...selectedManufacturers, trimmed]);
      setMfrSearch('');
    }
  };

  const totalMatchingProducts = selectedManufacturers.reduce((sum, name) => {
    const found = allManufacturers.find(
      (m) => m.name.toUpperCase() === name.toUpperCase()
    );
    return sum + (found ? found.product_count : 0);
  }, 0);

  const filteredMfrList = allManufacturers.filter((m) => {
    if (!mfrSearch.trim()) return true;
    return m.name.toLowerCase().includes(mfrSearch.toLowerCase());
  });

  const topManufacturers = allManufacturers.slice(0, 10);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Por favor, informe pelo menos o nome e o WhatsApp do vendedor/representante.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        tenant_id: tenantId,
        manufacturers: selectedManufacturers,
        binding_strategy: bindingStrategy,
      };

      let res;
      if (supplier) {
        res = await api.updateSupplier(supplier.id, payload);
      } else {
        res = await api.createSupplier(payload);
      }

      if (res && res.bind_stats && res.bind_stats.affected > 0) {
        alert(
          `✅ Vendedor "${res.name}" salvo com sucesso!\n\n✨ ${res.bind_stats.affected} medicamentos foram vinculados automaticamente a ele (estratégia: ${
            bindingStrategy === 'overwrite' ? 'Vendedor Principal' : 'Apenas Vazios'
          }).`
        );
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      alert('Erro ao salvar vendedor: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {supplier ? 'Editar Vendedor / Representante' : 'Novo Vendedor / Representante'}
              </h3>
              <p className="text-xs text-slate-500">
                Vincule aos fabricantes para assumir os produtos e receber alertas automáticos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Main Info */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <span>Nome do Representante / Vendedor *</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: João Silva ou Carlos Representante"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building size={13} className="text-slate-400" />
                <span>Empresa / Distribuidora</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Panpharma, Santa Cruz, Profarma"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone size={13} className="text-emerald-500" />
                <span>WhatsApp com DDD *</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: (11) 98765-4321"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                O robô ZapFarm envia cotações para este número
              </span>
            </div>
          </div>

          {/* Manufacturers Binding Section */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Factory size={15} className="text-indigo-600" />
                <span>Fabricantes / Laboratórios Representados</span>
              </label>
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                {selectedManufacturers.length} selecionado(s)
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              Selecione quais laboratórios este vendedor atende. Todos os produtos desses fabricantes serão associados a ele automaticamente!
            </p>

            {/* Quick chips of top manufacturers in pharmacy */}
            {topManufacturers.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                  Mais comuns na farmácia:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topManufacturers.map((m) => {
                    const isSelected = selectedManufacturers.includes(m.name);
                    return (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => toggleManufacturer(m.name)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isSelected ? <Check size={11} /> : <Plus size={11} className="text-slate-400" />}
                        <span>{m.name}</span>
                        <span className={`text-[10px] opacity-75`}>({m.product_count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search and full list */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar ou digitar outro fabricante..."
                    value={mfrSearch}
                    onChange={(e) => setMfrSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomManufacturer();
                      }
                    }}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {mfrSearch.trim() && (
                  <button
                    type="button"
                    onClick={handleAddCustomManufacturer}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-200 transition-colors shrink-0"
                  >
                    + Adicionar
                  </button>
                )}
              </div>

              {/* Scrollable list of matched manufacturers if search is typed */}
              {mfrSearch.trim() && (
                <div className="max-h-36 overflow-y-auto bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 p-1">
                  {filteredMfrList.length === 0 ? (
                    <div className="p-2 text-center text-[11px] text-slate-400">
                      Nenhum fabricante cadastrado com esse nome. Clique em "+ Adicionar" acima para incluir.
                    </div>
                  ) : (
                    filteredMfrList.map((m) => {
                      const isSelected = selectedManufacturers.includes(m.name);
                      return (
                        <div
                          key={m.name}
                          onClick={() => toggleManufacturer(m.name)}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-600 focus:ring-0"
                            />
                            <span className="font-semibold text-slate-700">{m.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {m.product_count} {m.product_count === 1 ? 'produto' : 'produtos'}
                            {m.assigned_suppliers && m.assigned_suppliers.length > 0 && (
                              <span className="ml-1 text-amber-600 text-[10px]">
                                (com {m.assigned_suppliers.map((s) => s.name).join(', ')})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Selected Badges */}
              {selectedManufacturers.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Fabricantes vinculados a este vendedor:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedManufacturers([])}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Limpar todos
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedManufacturers.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-[11px] font-bold"
                      >
                        <Factory size={11} className="text-indigo-600" />
                        {m}
                        <button
                          type="button"
                          onClick={() => toggleManufacturer(m)}
                          className="text-indigo-500 hover:text-rose-600 ml-0.5"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>

                  {totalMatchingProducts > 0 && (
                    <div className="mt-2.5 p-2 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <strong>{totalMatchingProducts} produtos</strong> cadastrados na farmácia pertencem a esses fabricantes!
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Strategy Options */}
            {selectedManufacturers.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Info size={13} className="text-indigo-500" />
                  <span>Regra se já houver produtos com outro vendedor:</span>
                </label>

                <div className="space-y-1.5">
                  <label className="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors bg-white hover:bg-slate-50 border-slate-200">
                    <input
                      type="radio"
                      name="bindingStrategy"
                      value="overwrite"
                      checked={bindingStrategy === 'overwrite'}
                      onChange={() => setBindingStrategy('overwrite')}
                      className="mt-0.5 text-emerald-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-800">Tornar Vendedor Principal (Recomendado)</p>
                      <p className="text-[11px] text-slate-500">
                        Assume todos os {totalMatchingProducts} medicamentos desses fabricantes como vendedor principal.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors bg-white hover:bg-slate-50 border-slate-200">
                    <input
                      type="radio"
                      name="bindingStrategy"
                      value="only_empty"
                      checked={bindingStrategy === 'only_empty'}
                      onChange={() => setBindingStrategy('only_empty')}
                      className="mt-0.5 text-emerald-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-800">Vincular apenas produtos sem vendedor</p>
                      <p className="text-[11px] text-slate-500">
                        Preserva os vendedores já existentes e adiciona este como secundário para cotação multivendedor.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors bg-white hover:bg-slate-50 border-slate-200">
                    <input
                      type="radio"
                      name="bindingStrategy"
                      value="save_only"
                      checked={bindingStrategy === 'save_only'}
                      onChange={() => setBindingStrategy('save_only')}
                      className="mt-0.5 text-emerald-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-800">Salvar apenas no cadastro</p>
                      <p className="text-[11px] text-slate-500">
                        Não altera os medicamentos agora; mantém apenas anotado no perfil do representante.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Mail size={13} className="text-slate-400" />
              <span>E-mail para Pedidos (Opcional)</span>
            </label>
            <input
              type="email"
              placeholder="vendas@distribuidora.com.br"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" />
              <span>Observações / Condições Comerciais</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Pedido mínimo R$ 400. Faturamento em boleto 28 dias. Visita terças."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <div className="text-[11px] text-emerald-800 leading-tight">
              <strong>Automação ZapFarm:</strong> Quando o estoque de qualquer remédio desses fabricantes atingir o nível mínimo, o robô enviará cotação e alerta direto para o WhatsApp deste representante.
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Salvando...' : supplier ? 'Atualizar Vendedor' : 'Cadastrar Vendedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
