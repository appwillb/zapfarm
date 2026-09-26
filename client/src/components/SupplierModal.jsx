import React, { useState, useEffect } from 'react';
import { X, UserCheck, Save, Phone, Building, Mail, FileText, CheckCircle2 } from 'lucide-react';
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

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        company: supplier.company || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        notes: supplier.notes || '',
        active: supplier.active ?? 1,
      });
    } else {
      setFormData({
        name: '',
        company: '',
        phone: '',
        email: '',
        notes: '',
        active: 1,
      });
    }
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Por favor, informe pelo menos o nome e o WhatsApp do vendedor/representante.');
      return;
    }

    setSaving(true);
    try {
      if (supplier) {
        await api.updateSupplier(supplier.id, {
          ...formData,
        });
      } else {
        await api.createSupplier({
          ...formData,
          tenant_id: tenantId,
        });
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
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
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
                Receberá cotações e alertas automáticos via WhatsApp quando o estoque baixar
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
                placeholder="Ex: Panpharma, EMS, SantaCruz"
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
                O robô ZapFarm envia mensagem direta para este número
              </span>
            </div>
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
              rows={3}
              placeholder="Ex: Visita toda terça-feira. Pedido mínimo R$ 400. Faturamento em boleto 28 dias."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <div className="text-[11px] text-emerald-800 leading-tight">
              <strong>Automação Ativa:</strong> Ao cadastrar ou importar medicamentos vinculados a este vendedor, o sistema alertará o WhatsApp dele assim que o saldo físico chegar na quantidade mínima.
            </div>
          </div>

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
