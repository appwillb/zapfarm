import React, { useState, useEffect } from 'react';
import { X, Bike, Save } from 'lucide-react';
import { api } from '../api';

export default function DriverModal({ isOpen, onClose, driver, tenantId, onSaved }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle: 'Moto',
    plate: '',
    fee_amount: '7.00',
    status: 'available',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      setFormData({
        name: driver.name || '',
        phone: driver.phone || '',
        vehicle: driver.vehicle || 'Moto',
        plate: driver.plate || '',
        fee_amount: driver.fee_amount?.toString() || '7.00',
        status: driver.status || 'available',
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        vehicle: 'Moto',
        plate: '',
        fee_amount: '7.00',
        status: 'available',
      });
    }
  }, [driver, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (driver) {
        await api.updateDriver(driver.id, {
          ...formData,
          fee_amount: Number(formData.fee_amount),
        });
      } else {
        await api.createDriver({
          ...formData,
          tenant_id: tenantId,
          fee_amount: Number(formData.fee_amount),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert('Erro ao salvar entregador: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bike size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                {driver ? 'Editar Entregador' : 'Novo Entregador / Motoboy'}
              </h3>
              <p className="text-xs text-slate-500">Dados para notificações via WhatsApp</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Alberto"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Número do WhatsApp *</label>
            <input
              type="text"
              required
              placeholder="5511999991111 (com DDD)"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Veículo</label>
              <input
                type="text"
                placeholder="Ex: Honda CG 160"
                value={formData.vehicle}
                onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Placa</label>
              <input
                type="text"
                placeholder="ABC-1234"
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Taxa por Entrega (R$)</label>
              <input
                type="number"
                step="0.50"
                value={formData.fee_amount}
                onChange={(e) => setFormData({ ...formData, fee_amount: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Status Inicial</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="available">🟢 Disponível</option>
                <option value="on_delivery">🟣 Em Entrega</option>
                <option value="offline">⚪ Offline</option>
              </select>
            </div>
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Gravando...' : 'Salvar Entregador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
