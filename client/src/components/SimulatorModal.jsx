import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, RotateCcw, Sparkles, Copy, Check } from 'lucide-react';
import { api } from '../api';

export default function SimulatorModal({ isOpen, onClose, tenantId, tenantName, tenantLogo, onOrderCreated }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [customerName, setCustomerName] = useState('Rozana');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const testPhone = '5511999990001';

  const loadHistory = async () => {
    try {
      const res = await api.getSimulationHistory(tenantId, testPhone);
      setMessages(res.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, tenantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    setInput('');
    setLoading(true);

    try {
      const res = await api.simulateMessage(tenantId, testPhone, customerName || 'Rozana', text);
      setMessages(res.messages || []);
      if (onOrderCreated) onOrderCreated();
    } catch (err) {
      alert('Erro na simulação: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Deseja reiniciar a simulação do zero?')) return;
    try {
      await api.resetSimulation(tenantId, testPhone);
      setMessages([]);
      handleSend('Olá, boa tarde');
    } catch (err) {
      alert('Erro ao reiniciar: ' + err.message);
    }
  };

  const handleCopyPix = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const quickChips = [
    'Olá, boa tarde',
    'Dipirona',
    '1',
    '2',
    'Finalizar Pedido',
    '1',
    'Av. Paulista, 1000 - Apto 54',
    'Já paguei, segue o comprovante',
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 backdrop-blur-xs">
      <div className="bg-slate-900 border-4 border-slate-700 rounded-[40px] max-w-sm w-full h-[680px] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Phone Notch */}
        <div className="h-6 bg-slate-950 flex items-center justify-center">
          <div className="w-24 h-4 bg-slate-800 rounded-b-xl flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 mr-2" />
            <div className="w-10 h-1.5 rounded-full bg-slate-900" />
          </div>
        </div>

        {/* WhatsApp Chat Header */}
        <div className="bg-emerald-700 text-white px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-800 border border-emerald-500/40 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
              {tenantLogo ? (
                <img src={tenantLogo} alt="" className="w-full h-full object-contain p-0.5 bg-white" />
              ) : (
                '⚕️'
              )}
            </div>
            <div>
              <h4 className="text-xs font-bold leading-tight truncate max-w-[170px]">
                {tenantName || 'Farmácia Central'}
              </h4>
              <p className="text-[10px] text-emerald-200">Robô ZapFarm &bull; online</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-emerald-800/80 transition-colors"
              title="Reiniciar Simulação"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-emerald-800/80 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Client Name Config for Balcão Voice Announcement */}
        <div className="bg-emerald-900/90 text-emerald-100 px-3 py-1 flex items-center justify-between text-[11px] border-b border-emerald-800 shrink-0">
          <span className="flex items-center gap-1 font-medium">
            <span>Cliente Simulada:</span>
          </span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="bg-emerald-950 text-white px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-600 focus:outline-none w-28 text-right"
              placeholder="Nome"
              title="A voz do balcão anunciará este nome ao receber as mensagens"
            />
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="bg-slate-800/90 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-700/60">
          <Sparkles size={11} className="text-emerald-400 shrink-0" />
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-2 bg-[#0b141a]">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs space-y-2">
              <Bot size={32} className="mx-auto text-emerald-500/60" />
              <p className="font-semibold text-slate-300">Simulador Interativo do WhatsApp</p>
              <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto">
                Envie uma mensagem abaixo para testar as buscas de medicamentos, carrinho, cálculo de frete e Pix.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isCustomer = m.from_me === 0;
              const isPixCode = m.text && m.text.startsWith('000201');
              return (
                <div key={m.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] p-2.5 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap ${
                      isCustomer
                        ? 'bg-[#005c4b] text-slate-100 rounded-tr-xs'
                        : isPixCode
                        ? 'bg-[#182229] border border-emerald-500/60 text-emerald-200 rounded-tl-xs shadow-md'
                        : 'bg-[#202c33] text-slate-100 rounded-tl-xs'
                    }`}
                  >
                    {isPixCode ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 pb-1">
                          <span className="font-bold text-emerald-400 text-[10px] flex items-center gap-1">
                            💠 Pix Copia e Cola
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPix(m.text, m.id)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] flex items-center gap-1 transition-colors shadow-xs"
                          >
                            {copiedId === m.id ? <Check size={11} /> : <Copy size={11} />}
                            {copiedId === m.id ? 'Copiado! ✅' : 'Copiar Pix'}
                          </button>
                        </div>
                        <p className="font-mono text-[9px] break-all select-all text-slate-200 leading-tight">
                          {m.text}
                        </p>
                      </div>
                    ) : (
                      <p>{m.text}</p>
                    )}
                    <span className="text-[8px] block text-right mt-1 text-slate-400">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="p-2 bg-[#202c33] text-emerald-400 rounded-xl text-[11px] italic animate-pulse">
                digitando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="bg-[#202c33] p-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="Mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-[#2a3942] text-slate-100 text-xs px-3 py-2 rounded-full border-none focus:outline-none placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center shrink-0 transition-colors"
          >
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
}
