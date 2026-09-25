import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Bot, Send, ShieldAlert, CheckCircle2, UserCheck, RefreshCw, Trash2, Copy, Check, Volume2, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { wsClient } from '../services/websocket';

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

export default function ChatTab({
  tenantId,
  initialPhone,
  onPhoneSelected,
  whatsappStatus,
  onNavigateTab,
}) {
  const [conversations, setConversations] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(initialPhone || null);
  const [mobileView, setMobileView] = useState(initialPhone ? 'chat' : 'list'); // 'list' | 'chat'
  const [activeChat, setActiveChat] = useState({ conversation: null, messages: [] });
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (initialPhone) {
      setSelectedPhone(initialPhone);
      setMobileView('chat');
    }
  }, [initialPhone]);

  const loadConversations = async () => {
    try {
      const data = await api.getConversations(tenantId);
      setConversations(data);
      if (!selectedPhone && data.length > 0) {
        const first = initialPhone || data[0].customer_phone;
        setSelectedPhone(first);
        if (onPhoneSelected) onPhoneSelected(first);
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadConversations(),
        selectedPhone ? loadMessages(selectedPhone) : Promise.resolve(),
      ]);
    } catch (e) {
      console.error('Error refreshing chat:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
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
      const interval = setInterval(() => loadMessages(selectedPhone), 4000);
      return () => clearInterval(interval);
    }
  }, [selectedPhone, tenantId]);

  // Real-time instant updates via WebSocket
  useEffect(() => {
    const unsub = wsClient.subscribe('new_chat_message', (payload) => {
      loadConversations();
      if (selectedPhone && payload.customerPhone === selectedPhone) {
        loadMessages(selectedPhone);
      }
    });
    return unsub;
  }, [selectedPhone, tenantId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedPhone) return;

    const text = messageInput;
    setMessageInput('');

    try {
      const res = await api.sendChatMessage(tenantId, selectedPhone, text);
      await loadMessages(selectedPhone);
      await loadConversations();
      if (res && res.warning) {
        alert(res.warning);
      }
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

  const handleDeleteConversation = async (phoneToDelete, customerName) => {
    const targetPhone = phoneToDelete || selectedPhone;
    if (!targetPhone) return;

    const displayName = customerName || formatPhone(targetPhone);
    const confirmed = window.confirm(
      `Deseja realmente excluir o contato ${displayName} do chat?\nTodas as mensagens deste cliente serão removidas do painel.`
    );
    if (!confirmed) return;

    // Optimistic UI update: remove immediately
    setConversations((prev) => prev.filter((c) => c.customer_phone !== targetPhone));
    if (selectedPhone === targetPhone) {
      setSelectedPhone(null);
      setActiveChat({ conversation: null, messages: [] });
    }

    try {
      await api.deleteConversation(tenantId, targetPhone);
      await loadConversations();
    } catch (err) {
      console.error('Erro ao excluir conversa:', err);
      alert('Erro ao excluir conversa: ' + err.message);
      await loadConversations();
    }
  };

  const isHuman = activeChat.conversation?.is_human_agent === 1;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden h-[calc(100vh-130px)] sm:h-[calc(100vh-140px)] flex flex-col md:flex-row">
      {/* Left Column: Conversations List */}
      <div className={`w-full md:w-80 border-r border-slate-200 flex-col bg-slate-50/50 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex flex-1 md:flex-initial'}`}>
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Atendimentos WhatsApp</h3>
            <p className="text-[11px] text-slate-500">{conversations.length} conversas ativas</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-200 text-xs font-semibold transition-all shadow-xs"
            title="Atualizar conversas e mensagens"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-400'} />
            <span className="hidden sm:inline">{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
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
                <div
                  key={c.id || c.customer_phone}
                  onClick={() => {
                    setSelectedPhone(c.customer_phone);
                    if (onPhoneSelected) onPhoneSelected(c.customer_phone);
                    setMobileView('chat');
                  }}
                  className={`group relative w-full p-3.5 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                    isSelected ? 'bg-white shadow-xs border-l-4 border-emerald-500' : 'hover:bg-slate-100/60'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    <User size={16} />
                  </div>
                  <div className="flex-1 min-w-0 pr-7">
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
                  {/* Quick Delete Contact Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(c.customer_phone, c.customer_name);
                    }}
                    className="absolute right-2 top-3 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                    title={`Excluir contato ${c.customer_name || c.customer_phone}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Chat Box */}
      <div className={`flex-1 flex-col bg-white ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {/* WhatsApp Offline Warning Banner */}
        {whatsappStatus?.status !== 'connected' && (
          <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between text-[11px] sm:text-xs text-amber-900 shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="truncate">
                <strong>WhatsApp Desconectado:</strong> Mensagens salvas, mas requer conexão para entregar.
              </span>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('whatsapp')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] sm:text-[11px] transition-colors shrink-0 shadow-xs"
              >
                Conectar
              </button>
            )}
          </div>
        )}

        {selectedPhone && activeChat.conversation ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-white gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
                  title="Voltar para a lista de conversas"
                >
                  <ArrowLeft size={19} />
                </button>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                  {activeChat.conversation.customer_name?.[0] || 'C'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                    {activeChat.conversation.customer_name || 'Cliente'}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <span>📱 {formatPhone(selectedPhone)}</span>
                    <span className="hidden sm:inline">&bull;</span>
                    <span className="hidden sm:inline">Estado: <strong className="text-emerald-600 uppercase font-mono text-[10px]">{activeChat.conversation.state}</strong></span>
                    <span>&bull;</span>
                    <span className={`inline-flex items-center gap-1 font-semibold text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded ${
                      whatsappStatus?.status === 'connected'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${whatsappStatus?.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {whatsappStatus?.status === 'connected' ? 'Online' : 'Desconectado'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors border border-slate-200 hover:border-emerald-200 shadow-xs"
                  title="Atualizar mensagens desta conversa"
                >
                  <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteConversation(selectedPhone, activeChat.conversation?.customer_name)}
                  className="p-1.5 sm:px-3 sm:py-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 hover:border-rose-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  title="Excluir este contato e mensagens"
                >
                  <Trash2 size={14} className="text-rose-500" />
                  <span className="hidden md:inline">Excluir</span>
                </button>

                {/* Toggle Human Handover */}
                <button
                  onClick={handleToggleHuman}
                  className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                    isHuman
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                  title={isHuman ? 'Bot Pausado' : 'Assumir Atendimento'}
                >
                  {isHuman ? (
                    <>
                      <Bot size={14} className="text-amber-700" />
                      <span className="hidden sm:inline">Bot Pausado (Reativar)</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={14} className="text-indigo-600" />
                      <span className="hidden sm:inline">Assumir Humano</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/40">
              {activeChat.messages?.map((m) => {
                const isMe = m.from_me === 1;
                const isPixCode = m.text && m.text.startsWith('000201');
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[75%] p-3 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-xs ${
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
            <form onSubmit={handleSendMessage} className="p-2.5 sm:p-3 border-t border-slate-200 bg-white flex gap-2">
              <input
                type="text"
                placeholder={
                  isHuman
                    ? 'Digite sua resposta como atendente...'
                    : 'Digite uma mensagem para o cliente...'
                }
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 px-3.5 sm:px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0"
              >
                <Send size={14} />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <MessageSquare size={48} className="text-slate-300 mb-2" />
            <p className="text-sm font-medium">Selecione uma conversa para visualizar as mensagens.</p>
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="mt-4 md:hidden px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2"
            >
              <ArrowLeft size={14} />
              <span>Ver Lista de Conversas</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
