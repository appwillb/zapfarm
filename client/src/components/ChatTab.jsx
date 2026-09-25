import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Bot, Send, ShieldAlert, CheckCircle2, UserCheck, RefreshCw, Trash2, Copy, Check } from 'lucide-react';
import { api } from '../api';

function formatPhone(phone) {
  if (!phone) return '';
  if (phone.includes('@lid')) return 'WhatsApp (Dispositivo Conectado)';
  const clean = phone.replace(/[^\d]/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12 && clean.startsWith('55')) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return phone;
}

export default function ChatTab({ tenantId }) {
  const [conversations, setConversations] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [activeChat, setActiveChat] = useState({ conversation: null, messages: [] });
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  const loadConversations = async () => {
    try {
      const data = await api.getConversations(tenantId);
      setConversations(data);
      if (!selectedPhone && data.length > 0) {
        setSelectedPhone(data[0].customer_phone);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadMessages = async (phone) => {
    if (!phone) return;
    try {
      const data = await api.getMessages(tenantId, phone);
      setActiveChat(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [tenantId]);

  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone);
      const interval = setInterval(() => loadMessages(selectedPhone), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedPhone, tenantId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedPhone) return;

    const text = messageInput;
    setMessageInput('');

    try {
      await api.sendChatMessage(tenantId, selectedPhone, text);
      await loadMessages(selectedPhone);
      await loadConversations();
    } catch (err) {
      alert('Erro ao enviar mensagem: ' + err.message);
    }
  };

  const handleToggleHuman = async () => {
    if (!activeChat.conversation) return;
    const currentIsHuman = activeChat.conversation.is_human_agent === 1;
    try {
      await api.toggleHumanSupport(tenantId, selectedPhone, !currentIsHuman);
      await loadMessages(selectedPhone);
      await loadConversations();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedPhone) return;
    if (!confirm('Deseja excluir esta conversa do painel?')) return;
    try {
      await fetch(`/api/chat/${tenantId}/conversations/${encodeURIComponent(selectedPhone)}`, {
        method: 'DELETE',
      });
      setSelectedPhone(null);
      setActiveChat({ conversation: null, messages: [] });
      await loadConversations();
    } catch (err) {
      alert('Erro ao excluir conversa: ' + err.message);
    }
  };

  const isHuman = activeChat.conversation?.is_human_agent === 1;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden h-[calc(100vh-140px)] flex flex-col md:flex-row">
      {/* Left Column: Conversations List */}
      <div className="w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Atendimentos WhatsApp</h3>
            <p className="text-[11px] text-slate-500">{conversations.length} conversas ativas</p>
          </div>
          <button
            onClick={loadConversations}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            title="Atualizar"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              Nenhuma conversa registrada ainda.
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = selectedPhone === c.customer_phone;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedPhone(c.customer_phone)}
                  className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 ${
                    isSelected ? 'bg-white shadow-xs border-l-4 border-emerald-500' : 'hover:bg-slate-100/60'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <User size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-xs text-slate-800 truncate">
                        {c.customer_name || 'Cliente WhatsApp'}
                      </p>
                      {c.is_human_agent === 1 && (
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded">
                          Humano
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">{formatPhone(c.customer_phone)}</p>
                    <p className="text-[11px] text-slate-600 truncate mt-1">
                      {c.last_message || 'Iniciando conversa...'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Chat Box */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedPhone && activeChat.conversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                  {activeChat.conversation.customer_name?.[0] || 'C'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {activeChat.conversation.customer_name || 'Cliente'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    📱 {formatPhone(selectedPhone)} &bull; Estado do Bot:{' '}
                    <strong className="text-emerald-600 uppercase font-mono text-[10px]">
                      {activeChat.conversation.state}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteConversation}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200"
                  title="Excluir esta conversa"
                >
                  <Trash2 size={16} />
                </button>

                {/* Toggle Human Handover */}
                <button
                  onClick={handleToggleHuman}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isHuman
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  {isHuman ? (
                    <>
                      <Bot size={14} className="text-amber-700" />
                      <span>Bot Pausado (Clique p/ Reativar)</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={14} className="text-indigo-600" />
                      <span>Assumir Atendimento Humano</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
              {activeChat.messages?.map((m) => {
                const isMe = m.from_me === 1;
                const isPixCode = m.text && m.text.startsWith('000201');
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-xs ${
                        isMe
                          ? isPixCode
                            ? 'bg-slate-900 text-white rounded-tr-xs border border-emerald-500/40'
                            : 'bg-emerald-600 text-white rounded-tr-xs'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
                      }`}
                    >
                      {isPixCode ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-1.5">
                            <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                              💠 Pix Copia e Cola
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(m.text);
                                setCopiedMsgId(m.id);
                                setTimeout(() => setCopiedMsgId(null), 2500);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors shadow-xs"
                            >
                              {copiedMsgId === m.id ? <Check size={12} /> : <Copy size={12} />}
                              {copiedMsgId === m.id ? 'Copiado! ✅' : 'Copiar Pix'}
                            </button>
                          </div>
                          <p className="font-mono text-[10px] break-all select-all text-slate-200 bg-black/30 p-2 rounded-xl border border-white/10 leading-tight">
                            {m.text}
                          </p>
                        </div>
                      ) : (
                        <p>{m.text}</p>
                      )}
                      <span
                        className={`text-[9px] block text-right mt-1 ${
                          isMe ? 'text-emerald-100' : 'text-slate-400'
                        }`}
                      >
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex gap-2">
              <input
                type="text"
                placeholder={
                  isHuman
                    ? 'Digite sua resposta como atendente/farmacêutico...'
                    : 'Digite uma mensagem (o cliente receberá no WhatsApp)...'
                }
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Send size={14} />
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <MessageSquare size={48} className="text-slate-300 mb-2" />
            <p className="text-sm font-medium">Selecione uma conversa ao lado para visualizar as mensagens.</p>
          </div>
        )}
      </div>
    </div>
  );
}
