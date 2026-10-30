import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, User, Bot, Send, ShieldAlert, CheckCircle2, UserCheck, RefreshCw, Trash2, Copy, Check, Volume2, ArrowLeft, FileText, ExternalLink, Receipt, RotateCw, RotateCcw, ZoomIn, ZoomOut, Maximize2, X, Sparkles } from 'lucide-react';
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

function isSamePhone(p1, p2) {
  if (!p1 || !p2) return false;
  if (p1 === p2) return true;
  const c1 = String(p1).replace(/[^\d]/g, '');
  const c2 = String(p2).replace(/[^\d]/g, '');
  if (c1 && c2 && (c1 === c2 || c1.endsWith(c2) || c2.endsWith(c1))) return true;
  return false;
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
  const [lightboxImage, setLightboxImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  // Refs to avoid stale closures in intervals/WebSockets and enable smooth auto-scrolling
  const selectedPhoneRef = useRef(selectedPhone);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  useEffect(() => {
    if (initialPhone && initialPhone !== selectedPhoneRef.current) {
      setSelectedPhone(initialPhone);
      selectedPhoneRef.current = initialPhone;
      setMobileView('chat');
    }
  }, [initialPhone]);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    } else if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Scroll to bottom whenever messages change or user switches conversation
  useEffect(() => {
    if (activeChat.messages?.length > 0) {
      scrollToBottom('auto');
      const timer = setTimeout(() => scrollToBottom('smooth'), 50);
      return () => clearTimeout(timer);
    }
  }, [activeChat.messages?.length, selectedPhone]);

  const loadConversations = async () => {
    try {
      const data = await api.getConversations(tenantId);
      setConversations(data);
      // Only default to first conversation if user hasn't selected ANY conversation yet
      if (!selectedPhoneRef.current && data.length > 0) {
        const first = initialPhone || data[0].customer_phone;
        setSelectedPhone(first);
        selectedPhoneRef.current = first;
        if (onPhoneSelected) onPhoneSelected(first);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadMessages = async (phone) => {
    const target = phone || selectedPhoneRef.current;
    if (!target) return;
    try {
      const data = await api.getMessages(tenantId, target);
      setActiveChat(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectConversation = (phone) => {
    setSelectedPhone(phone);
    selectedPhoneRef.current = phone;
    if (onPhoneSelected) onPhoneSelected(phone);
    setMobileView('chat');
    setAiSuggestion('');
    loadMessages(phone);
  };

  const handleGetAiSuggestion = async () => {
    const phone = selectedPhoneRef.current || selectedPhone;
    if (!phone) return;
    setLoadingSuggestion(true);
    try {
      const res = await api.suggestReply(tenantId, phone);
      if (res?.suggestion) {
        setAiSuggestion(res.suggestion);
      } else {
        alert('Nenhuma sugestão gerada para esta mensagem.');
      }
    } catch (err) {
      console.error('Erro ao gerar sugestão de IA:', err);
      alert('Erro ao gerar sugestão de IA: ' + err.message);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadConversations(),
        selectedPhoneRef.current ? loadMessages(selectedPhoneRef.current) : Promise.resolve(),
      ]);
    } catch (e) {
      console.error('Error refreshing chat:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Periodic poll of conversations list
  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [tenantId]);

  // Periodic poll of active conversation messages
  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone);
      const interval = setInterval(() => {
        if (selectedPhoneRef.current) {
          loadMessages(selectedPhoneRef.current);
        }
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [selectedPhone, tenantId]);

  // Real-time instant updates via WebSocket
  useEffect(() => {
    const unsub = wsClient.subscribe('new_chat_message', (payload) => {
      loadConversations();
      const current = selectedPhoneRef.current;
      if (current && payload?.customerPhone && isSamePhone(payload.customerPhone, current)) {
        loadMessages(current);
      }
    });
    return unsub;
  }, [tenantId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const current = selectedPhoneRef.current || selectedPhone;
    if (!messageInput.trim() || !current) return;

    const text = messageInput;
    setMessageInput('');

    try {
      const res = await api.sendChatMessage(tenantId, current, text);
      await loadMessages(current);
      await loadConversations();
      setTimeout(() => scrollToBottom('smooth'), 50);
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
    const current = selectedPhoneRef.current || selectedPhone;
    try {
      await api.toggleHumanSupport(tenantId, current, !currentIsHuman);
      await loadMessages(current);
      await loadConversations();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleDeleteConversation = async (phoneToDelete, customerName) => {
    const targetPhone = phoneToDelete || selectedPhoneRef.current || selectedPhone;
    if (!targetPhone) return;

    const displayName = customerName || formatPhone(targetPhone);
    const confirmed = window.confirm(
      `Deseja realmente excluir o contato ${displayName} do chat?\nTodas as mensagens deste cliente serão removidas do painel.`
    );
    if (!confirmed) return;

    // Optimistic UI update: remove immediately
    setConversations((prev) => prev.filter((c) => c.customer_phone !== targetPhone));
    if (selectedPhoneRef.current === targetPhone) {
      setSelectedPhone(null);
      selectedPhoneRef.current = null;
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
                  onClick={() => handleSelectConversation(c.customer_phone)}
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
                      {c.has_pending_prescription === 1 ? (
                        <span className="text-[9px] bg-purple-100 text-purple-800 font-extrabold px-1.5 py-0.5 rounded border border-purple-300 animate-pulse flex items-center gap-0.5">
                          🩺 Receita
                        </span>
                      ) : c.is_human_agent === 1 ? (
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded">
                          Humano
                        </span>
                      ) : null}
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

                {/* AI Sales Copilot Button */}
                <button
                  type="button"
                  onClick={handleGetAiSuggestion}
                  disabled={loadingSuggestion}
                  className="p-1.5 sm:px-3 sm:py-1.5 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors border border-purple-200 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  title="Pedir para a IA sugerir uma resposta de venda"
                >
                  <Sparkles size={14} className={loadingSuggestion ? 'animate-spin text-purple-600' : 'text-purple-600'} />
                  <span className="hidden sm:inline">{loadingSuggestion ? 'Gerando...' : 'IA Vender'}</span>
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

            {/* Prescription Review Alert Banner */}
            {(activeChat.conversation.has_pending_prescription === 1 || activeChat.conversation.state === 'prescription_review') && (
              <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white px-3 sm:px-4 py-2.5 flex items-center justify-between border-b border-purple-800 shrink-0 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0 animate-bounce select-none">🩺</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-purple-100 truncate">
                      Receita Médica / Orçamento Pendente
                    </p>
                    <p className="text-[11px] text-purple-200/80 truncate">
                      O bot foi pausado automaticamente. Verifique a receita e passe o valor ao cliente.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-purple-500/30 text-purple-200 border border-purple-400/50 px-2.5 py-1 rounded-full shrink-0 animate-pulse ml-2">
                  Farmacêutico
                </span>
              </div>
            )}

            {/* Messages Area */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/40 scroll-smooth"
            >
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
                      {/* Media Attachment (Photo / Document / Receipt) */}
                      {m.media_url && (
                        <div className="mb-2">
                          {m.media_type === 'image' || m.media_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                            <div className="space-y-1.5">
                              <div className="rounded-xl overflow-hidden border border-slate-200/80 bg-black/10 relative group">
                                <img
                                  src={m.media_url}
                                  alt="Anexo / Receita / Comprovante"
                                  className="max-h-60 w-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                  onClick={() => {
                                    setLightboxImage(m.media_url);
                                    setRotation(0);
                                    setZoom(1);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLightboxImage(m.media_url);
                                    setRotation(0);
                                    setZoom(1);
                                  }}
                                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Ampliar e Girar Imagem"
                                >
                                  <Maximize2 size={13} />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setLightboxImage(m.media_url);
                                  setRotation(0);
                                  setZoom(1);
                                }}
                                className={`w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[10px] font-bold transition-colors ${
                                  isMe
                                    ? 'bg-emerald-700/80 hover:bg-emerald-700 text-white'
                                    : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200'
                                }`}
                              >
                                <RotateCw size={11} className="text-purple-600" />
                                <span>🩺 Ampliar & Girar Receita</span>
                              </button>
                            </div>
                          ) : (
                            <a
                              href={m.media_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                isMe
                                  ? 'bg-emerald-700/80 text-white border-emerald-500'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                              }`}
                            >
                              <FileText size={14} />
                              <span>Abrir Documento / PDF</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      )}

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
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* AI Sales Copilot Suggestion Card */}
            {aiSuggestion && (
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50/70 to-purple-50/40 border-t border-purple-200/90 p-2.5 sm:px-4 sm:py-2.5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-purple-900 tracking-wider block">
                      Sugestão da IA para Fechar Venda:
                    </span>
                    <p className="text-xs text-slate-700 line-clamp-2 italic">"{aiSuggestion}"</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMessageInput(aiSuggestion);
                      setAiSuggestion('');
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold transition-all shadow-xs"
                    title="Colocar o texto no campo para editar antes de enviar"
                  >
                    Inserir
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const textToSend = aiSuggestion;
                      setAiSuggestion('');
                      const current = selectedPhoneRef.current || selectedPhone;
                      if (!textToSend || !current) return;
                      try {
                        await api.sendChatMessage(tenantId, current, textToSend);
                        await loadMessages(current);
                        await loadConversations();
                        setTimeout(() => scrollToBottom('smooth'), 50);
                      } catch (err) {
                        alert('Erro ao enviar mensagem: ' + err.message);
                      }
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                    title="Enviar esta resposta sugerida diretamente ao cliente"
                  >
                    <Send size={12} />
                    <span>Enviar Direto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiSuggestion('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
                    title="Dispensar sugestão"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-2.5 sm:p-3 border-t border-slate-200 bg-white flex gap-2">
              <button
                type="button"
                onClick={handleGetAiSuggestion}
                disabled={loadingSuggestion}
                className="p-2 sm:px-3 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors border border-purple-200 text-xs font-bold flex items-center gap-1.5 shadow-xs shrink-0"
                title="Pedir para a IA sugerir uma resposta de venda"
              >
                <Sparkles size={14} className={loadingSuggestion ? 'animate-spin text-purple-600' : 'text-purple-600'} />
                <span className="hidden sm:inline">{loadingSuggestion ? 'Gerando...' : 'Sugerir com IA'}</span>
              </button>
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

      {/* Prescription / Image Lightbox Modal with 90° Rotate & Zoom */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          {/* Top Controls Toolbar */}
          <div
            className="w-full max-w-4xl flex items-center justify-between mb-3 text-white px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold flex items-center gap-1.5">
                <span>🩺</span>
                <span className="hidden sm:inline">Visualizador de Receita & Anexos</span>
                <span className="sm:hidden">Receita</span>
              </span>
              <span className="text-xs text-slate-300 font-mono">
                ({rotation}° | {Math.round(zoom * 100)}%)
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Girar 90° para a esquerda"
              >
                <RotateCcw size={15} />
                <span className="hidden md:inline">-90°</span>
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Girar 90° para a direita"
              >
                <RotateCw size={15} />
                <span className="hidden md:inline">+90°</span>
              </button>
              <div className="h-5 w-px bg-white/20 mx-0.5 hidden sm:block" />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Diminuir Zoom"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Aumentar Zoom"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors hidden sm:block"
                title="Redefinir visualização"
              >
                Reset
              </button>
              <div className="h-5 w-px bg-white/20 mx-0.5 hidden sm:block" />
              <button
                type="button"
                onClick={() => window.open(lightboxImage, '_blank')}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Abrir imagem original em nova aba"
              >
                <ExternalLink size={15} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors ml-1"
                title="Fechar (ESC)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Image Display Area */}
          <div
            className="relative max-w-4xl max-h-[78vh] w-full flex items-center justify-center overflow-auto rounded-2xl bg-black/50 border border-white/15 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage}
              alt="Receita Médica Ampliada"
              style={{
                transform: `rotate(${rotation}deg) scale(${zoom})`,
                transition: 'transform 0.2s ease-in-out',
                maxWidth: '100%',
                maxHeight: '72vh',
                objectFit: 'contain',
              }}
              className="select-none shadow-2xl rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
