import React, { useState, useEffect } from 'react';
import { X, Pill, Save, UserCheck, Plus, UserPlus } from 'lucide-react';
import { api } from '../api';

export default function ProductModal({ isOpen, onClose, product, tenantId, onSaved }) {
  const [formData, setFormData] = useState({
    name: '',
    active_ingredient: '',
    manufacturer: '',
    dosage: '',
    form: 'Comprimido',
    presentation: '',
    barcode: '',
    cost_price: '0.00',
    sale_price: '',
    stock_quantity: '10',
    min_stock: '5',
    requires_prescription: false,
    prescription_type: 'livre',
    category: 'Medicamentos',
    supplier_id: '',
  });

  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [newSuppName, setNewSuppName] = useState('');
  const [newSuppPhone, setNewSuppPhone] = useState('');
  const [newSuppCompany, setNewSuppCompany] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  useEffect(() => {
    if (isOpen && tenantId) {
      loadSuppliers();
    }
  }, [isOpen, tenantId]);

  const loadSuppliers = async () => {
    try {
      const list = await api.getSuppliers(tenantId);
      setSuppliers(list || []);
    } catch (err) {
      console.error('Erro ao carregar vendedores:', err);
    }
  };

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        active_ingredient: product.active_ingredient || '',
        manufacturer: product.manufacturer || '',
        dosage: product.dosage || '',
        form: product.form || 'Comprimido',
        presentation: product.presentation || '',
        barcode: product.barcode || '',
        cost_price: product.cost_price?.toString() || '0.00',
        sale_price: product.sale_price?.toString() || '',
        stock_quantity: product.stock_quantity?.toString() || '10',
        min_stock: product.min_stock?.toString() || '5',
        requires_prescription: product.requires_prescription === 1,
        prescription_type: product.prescription_type || 'livre',
        category: product.category || 'Medicamentos',
        supplier_id: product.supplier_id ? product.supplier_id.toString() : '',
      });
    } else {
      setFormData({
        name: '',
        active_ingredient: '',
        manufacturer: '',
        dosage: '',
        form: 'Comprimido',
        presentation: '',
        barcode: '',
        cost_price: '0.00',
        sale_price: '',
        stock_quantity: '10',
        min_stock: '5',
        requires_prescription: false,
        prescription_type: 'livre',
        category: 'Medicamentos',
        supplier_id: '',
      });
    }
  }, [product, isOpen]);

  const handleQuickCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSuppName.trim() || !newSuppPhone.trim()) {
      alert('Preencha pelo menos o nome e WhatsApp do vendedor.');
      return;
    }

    setCreatingSupplier(true);
    try {
      const created = await api.createSupplier({
        tenant_id: tenantId,
        name: newSuppName.trim(),
        phone: newSuppPhone.trim(),
        company: newSuppCompany.trim(),
      });

      await loadSuppliers();
      setFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
      setShowQuickAddSupplier(false);
      setNewSuppName('');
      setNewSuppPhone('');
      setNewSuppCompany('');
      alert(`Vendedor ${created.name} cadastrado e vinculado!`);
    } catch (err) {
      alert('Erro ao cadastrar vendedor: ' + err.message);
    } finally {
      setCreatingSupplier(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        cost_price: Number(formData.cost_price),
        sale_price: Number(formData.sale_price),
        stock_quantity: Number(formData.stock_quantity),
        min_stock: Number(formData.min_stock),
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
      };

      if (product) {
        await api.updateProduct(product.id, payload);
      } else {
        await api.createProduct({
          ...payload,
          tenant_id: tenantId,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert('Erro ao salvar produto: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedSupplier = suppliers.find(s => s.id === Number(formData.supplier_id));

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Pill size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {product ? 'Editar Medicamento' : 'Cadastrar Novo Medicamento'}
              </h3>
              <p className="text-xs text-slate-500">
                Preencha os dados da apresentação exata do produto e vincule o vendedor
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nome Comercial *</label>
              <input
                type="text"
                required
                placeholder="Ex: Dipirona Monoidratada"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Princípio Ativo</label>
              <input
                type="text"
                placeholder="Ex: Dipirona Sódica"
                value={formData.active_ingredient}
                onChange={(e) => setFormData({ ...formData, active_ingredient: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Dosagem</label>
              <input
                type="text"
                placeholder="Ex: 500mg, 1g, 20ml"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Forma Farmacêutica</label>
              <select
                value={formData.form}
                onChange={(e) => setFormData({ ...formData, form: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="Comprimido">Comprimido</option>
                <option value="Cápsula">Cápsula</option>
                <option value="Gotas">Gotas</option>
                <option value="Xarope">Xarope</option>
                <option value="Pomada">Pomada / Creme</option>
                <option value="Injetável">Injetável</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Apresentação Exata</label>
              <input
                type="text"
                placeholder="Ex: Caixa com 20 comprimidos"
                value={formData.presentation}
                onChange={(e) => setFormData({ ...formData, presentation: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Supplier / Seller Association Section */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <UserCheck size={15} className="text-blue-600" />
                <span>Vendedor / Representante Comercial Responsável:</span>
              </label>
              <button
                type="button"
                onClick={() => setShowQuickAddSupplier(!showQuickAddSupplier)}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs transition-colors"
              >
                <Plus size={12} />
                <span>{showQuickAddSupplier ? 'Fechar Cadastro' : '+ Cadastrar Novo Vendedor'}</span>
              </button>
            </div>

            {!showQuickAddSupplier ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="">Nenhum vendedor vinculado</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      👤 {s.name} {s.company ? `(${s.company})` : ''} - 📱 {s.phone}
                    </option>
                  ))}
                </select>
                {selectedSupplier && (
                  <span className="text-[11px] font-semibold text-blue-800 bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-200 shrink-0">
                    🔔 Alerta via WhatsApp em: {selectedSupplier.phone}
                  </span>
                )}
              </div>
            ) : (
              /* Inline Form to register new supplier */
              <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-2">
                <p className="text-[11px] font-bold text-blue-900">Cadastrar Novo Vendedor / Representante:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Nome (ex: João Representante)"
                    value={newSuppName}
                    onChange={(e) => setNewSuppName(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp (ex: 11999998888)"
                    value={newSuppPhone}
                    onChange={(e) => setNewSuppPhone(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Distribuidora / Laboratório"
                    value={newSuppCompany}
                    onChange={(e) => setNewSuppCompany(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowQuickAddSupplier(false)}
                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickCreateSupplier}
                    disabled={creatingSupplier}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    {creatingSupplier ? 'Salvando...' : 'Salvar e Vincular'}
                  </button>
                </div>
              </div>
            )}

            <p className="text-[10px] text-blue-700 leading-tight">
              💡 Quando o estoque deste medicamento atingir ou ficar abaixo do <strong>Estoque Mínimo</strong>, o robô enviará um alerta automático para o WhatsApp do vendedor solicitando cotação de reposição.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Fabricante / Laboratório</label>
              <input
                type="text"
                placeholder="Ex: EMS, Medley, Eurofarma"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Código de Barras (EAN)</label>
              <input
                type="text"
                placeholder="789..."
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Preço Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Preço Venda * (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                className="w-full p-2.5 bg-emerald-50 border border-emerald-300 font-bold rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Estoque Físico</label>
              <input
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Estoque Mínimo (Gatilho)</label>
              <input
                type="number"
                value={formData.min_stock}
                onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="prescriptionCheck"
                checked={formData.requires_prescription}
                onChange={(e) => setFormData({ ...formData, requires_prescription: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="prescriptionCheck" className="font-bold text-slate-800 cursor-pointer">
                Exige Retenção ou Conferência de Receita Médica?
              </label>
            </div>

            {formData.requires_prescription && (
              <div className="pl-6 text-xs">
                <label className="font-bold text-slate-700 block mb-1">Classificação da Tarja</label>
                <select
                  value={formData.prescription_type}
                  onChange={(e) => setFormData({ ...formData, prescription_type: e.target.value })}
                  className="w-full sm:w-60 p-2 bg-white border border-amber-300 rounded-lg"
                >
                  <option value="tarja_vermelha">Tarja Vermelha (Sob Prescrição)</option>
                  <option value="antibiotico">Antibiótico (Receita em 2 vias)</option>
                  <option value="tarja_preta">Tarja Preta (Controle Especial)</option>
                </select>
                <p className="text-[10px] text-amber-800 mt-1">
                  O robô do WhatsApp solicitará a foto da receita antes de permitir a conclusão do pedido.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Gravando...' : product ? 'Salvar Alterações' : 'Cadastrar Medicamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
