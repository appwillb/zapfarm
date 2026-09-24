import React from 'react';
import { Plus, Bike, Phone, MessageSquare, Check, X, Send } from 'lucide-react';

export default function DriversTab({
  drivers,
  onOpenAddDriver,
  onUpdateDriverStatus,
  onTestDriverMessage,
  onDeleteDriver,
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Entregadores & Motoboys da Farmácia</h2>
          <p className="text-xs text-slate-500">
            Gerencie os motoboys cadastrados. O sistema envia a rota e detalhes de entrega via WhatsApp automaticamente após o pagamento e liberação.
          </p>
        </div>
        <button
          onClick={onOpenAddDriver}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs shrink-0"
        >
          <Plus size={14} />
          Cadastrar Entregador
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((driver) => {
          const statusMap = {
            available: { label: 'Disponível', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
            on_delivery: { label: 'Em Entrega', color: 'bg-purple-100 text-purple-800 border-purple-300' },
            offline: { label: 'Offline / Folga', color: 'bg-slate-100 text-slate-600 border-slate-300' },
          }[driver.status] || { label: driver.status, color: 'bg-slate-100 text-slate-700' };

          return (
            <div
              key={driver.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Bike size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{driver.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone size={11} /> {driver.phone}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMap.color}`}
                  >
                    {statusMap.label}
                  </span>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
                  <div className="flex justify-between text-slate-600">
                    <span>Veículo:</span>
                    <span className="font-semibold text-slate-800">{driver.vehicle || 'Moto'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Placa:</span>
                    <span className="font-semibold font-mono text-slate-800">{driver.plate || '—'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Taxa por Corrida:</span>
                    <span className="font-bold text-emerald-600">R$ {Number(driver.fee_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <select
                  value={driver.status}
                  onChange={(e) => onUpdateDriverStatus(driver.id, e.target.value)}
                  className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none"
                >
                  <option value="available">🟢 Disponível</option>
                  <option value="on_delivery">🟣 Em Entrega</option>
                  <option value="offline">⚪ Offline</option>
                </select>

                <button
                  onClick={() => onTestDriverMessage(driver.id)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                  title="Enviar mensagem de teste no WhatsApp do entregador"
                >
                  <Send size={12} className="text-slate-500" />
                  Testar WhatsApp
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
