import React, { useState } from 'react';
import { X, CheckCircle, Bike, Clock, QrCode, DollarSign, MapPin, Phone, ShieldCheck, Copy, Check } from 'lucide-react';

export default function OrderDetailsModal({
  isOpen,
  onClose,
  order,
  onConfirmPayment,
  onReleaseDelivery,
  onMarkDelivered,
}) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  if (!isOpen || !order) return null;

  const statusMap = {
    pending_payment: { label: 'Aguardando Pagamento Pix', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    paid: { label: 'Pago & Em Separação', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    ready_for_delivery: { label: 'Pronto / Aguardando Motoboy', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    in_transit: { label: 'Em Rota de Entrega (Motoboy)', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    delivered: { label: 'Entregue com Sucesso', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    cancelled: { label: 'Pedido Cancelado', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  }[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-800 border-slate-300' };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-800 text-lg">Pedido #{order.id}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMap.color}`}>
                {statusMap.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Criado em: {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Customer & Delivery Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium">
              <Phone size={13} className="text-slate-400" /> Cliente:
            </span>
            <span className="font-bold text-slate-800">
              {order.customer_name || 'Cliente'} ({order.customer_phone})
            </span>
          </div>
          <div className="flex items-start justify-between">
            <span className="text-slate-500 flex items-center gap-1.5 font-medium shrink-0 pt-0.5">
              <MapPin size={13} className="text-slate-400" /> Entrega:
            </span>
            <span className="font-semibold text-slate-700 text-right max-w-xs">
              {order.delivery_type === 'pickup' ? '🏪 Retirada no Balcão da Farmácia' : order.delivery_address}
            </span>
          </div>
          {order.notes && (
            <div className="pt-1 text-[11px] text-slate-600 border-t border-slate-200/60">
              <strong>Observações:</strong> {order.notes}
            </div>
          )}
        </div>

        {/* Items List */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Itens Solicitados</h4>
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
            {order.items?.map((it, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                <div>
                  <p className="font-bold text-slate-800">{it.product_name}</p>
                  <p className="text-[10px] text-slate-500">
                    {it.dosage} &bull; {it.presentation}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-slate-600">
                    {it.quantity}x R$ {Number(it.unit_price).toFixed(2)}
                  </span>
                  <p className="font-bold text-slate-800">R$ {Number(it.total_price).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal Medicamentos:</span>
            <span>R$ {Number(order.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Taxa de Entrega:</span>
            <span>R$ {Number(order.delivery_fee).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-extrabold text-sm text-slate-800 pt-1.5 border-t border-slate-200">
            <span>Total:</span>
            <span className="text-emerald-700">R$ {Number(order.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Confirmation Log */}
        {order.payment_confirmed_at && (
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">Pagamento Pix Confirmado!</p>
              <p className="text-[11px] text-emerald-700">
                Data: {new Date(order.payment_confirmed_at).toLocaleString()} &bull; Conferido por:{' '}
                {order.confirmed_by_user || 'Equipe'}
              </p>
            </div>
          </div>
        )}

        {/* Driver Log */}
        {order.driver_name && (
          <div className="p-3 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-xs flex items-center gap-2">
            <Bike size={16} className="text-purple-600 shrink-0" />
            <div>
              <p className="font-bold">Entregador em Rota: {order.driver_name}</p>
              <p className="text-[11px] text-purple-700">
                Veículo: {order.driver_vehicle} {order.driver_plate ? `(${order.driver_plate})` : ''} &bull; Notificado no WhatsApp em:{' '}
                {order.driver_notified_at ? new Date(order.driver_notified_at).toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Pix Copia e Cola Code Display */}
        {order.pix_code && (
          <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <QrCode size={13} className="text-emerald-600" />
                Código Pix Copia e Cola
              </label>
              <div className="flex items-center gap-2">
                {order.pix_qrcode_url && (
                  <button
                    type="button"
                    onClick={() => setShowQrCode(!showQrCode)}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 transition-colors"
                  >
                    {showQrCode ? 'Ocultar QR Code' : 'Ver QR Code'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(order.pix_code);
                    setCopiedPix(true);
                    setTimeout(() => setCopiedPix(false), 2500);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shadow-xs"
                >
                  {copiedPix ? <Check size={12} /> : <Copy size={12} />}
                  {copiedPix ? 'Copiado! ✅' : 'Copiar Pix'}
                </button>
              </div>
            </div>

            {showQrCode && order.pix_qrcode_url && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center">
                <img src={order.pix_qrcode_url} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                <span className="text-[10px] text-slate-400 mt-1">Escaneie pelo aplicativo do seu banco</span>
              </div>
            )}

            <div className="p-2.5 bg-white rounded-xl text-[10px] font-mono break-all text-slate-700 select-all border border-slate-200 leading-tight">
              {order.pix_code}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
          {order.status === 'pending_payment' && (
            <button
              onClick={() => {
                onConfirmPayment(order.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle size={14} />
              Confirmar Pix e Liberar Preparo
            </button>
          )}

          {order.status === 'paid' && (
            <button
              onClick={() => {
                onReleaseDelivery(order.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-1.5"
            >
              <Bike size={14} />
              Liberar Pacote para Motoboy
            </button>
          )}

          {order.status === 'in_transit' && (
            <button
              onClick={() => {
                onMarkDelivered(order.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle size={14} />
              Confirmar Entrega Realizada
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
