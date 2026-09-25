import React, { useState, useEffect, useRef } from 'react';
import {
  Megaphone,
  Upload,
  Image as ImageIcon,
  Trash2,
  Send,
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  Sparkles,
  Smartphone,
  RefreshCw,
  Info,
  Check,
  Eye,
  UserPlus,
  FileSpreadsheet,
  Search,
  Filter,
  X,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  CheckSquare,
  Square,
  Target,
} from 'lucide-react';
import { api } from '../api';

// Helper to format Brazilian phone numbers for friendly UI
function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

// Helper to compress image in browser before sending to server
function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export default function CampaignsTab({ tenant, whatsappStatus, onNavigateTab }) {
  // Navigation section: 'builder' | 'preview' | 'leads' | 'history'
  const [activeSection, setActiveSection] = useState('builder');

  const [leadsData, setLeadsData] = useState({ total_available: 0, total_opt_out: 0, leads: [] });
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [campaignsList, setCampaignsList] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Draft persistence helper
  const draftKey = tenant?.id ? `zapfarm_campaign_draft_${tenant.id}` : null;
  const loadDraft = () => {
    if (!draftKey) return null;
    try {
      const saved = localStorage.getItem(draftKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const initialDraft = loadDraft();

  // Form State (hydrated from draft)
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [message, setMessage] = useState(initialDraft?.message || '');
  const [imagePreview, setImagePreview] = useState(initialDraft?.imagePreview || null);
  const [includeOptOut, setIncludeOptOut] = useState(
    initialDraft?.includeOptOut !== undefined ? initialDraft.includeOptOut : true
  );
  const [delaySeconds, setDelaySeconds] = useState(initialDraft?.delaySeconds || 25);
  const [targetAudience, setTargetAudience] = useState(initialDraft?.targetAudience || 'all');
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  // Selected phone numbers set for targeted broadcasting
  const [selectedPhones, setSelectedPhones] = useState(new Set());

  const [testPhone, setTestPhone] = useState(tenant?.phone || '');
  const [testingSend, setTestingSend] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [startingCampaign, setStartingCampaign] = useState(false);

  // Live active campaign tracking
  const [activeCampaign, setActiveCampaign] = useState(null);

  // Lead Management state & filters
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('all');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Add Single Lead Form
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  // Bulk Import Form
  const [bulkText, setBulkText] = useState('');
  const [importingBulk, setImportingBulk] = useState(false);

  const fileInputRef = useRef(null);

  // Auto-save draft on changes
  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      try {
        const draft = {
          title,
          message,
          imagePreview,
          includeOptOut,
          delaySeconds,
          targetAudience,
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftSavedAt(new Date());
      } catch (err) {
        console.warn('Erro ao salvar rascunho:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [draftKey, title, message, imagePreview, includeOptOut, delaySeconds, targetAudience]);

  // Clear draft function
  const handleClearDraft = () => {
    if (!title && !message && !imagePreview) return;
    if (confirm('Deseja limpar o rascunho da campanha (título, texto e imagem)?')) {
      setTitle('');
      setMessage('');
      setImagePreview(null);
      setTargetAudience('all');
      setSelectedPhones(new Set());
      if (draftKey) {
        localStorage.removeItem(draftKey);
      }
      setDraftSavedAt(null);
    }
  };

  // Pre-built promotional templates for pharmacies
  const TEMPLATES = [
    {
      title: '☀️ Oferta de Verão & Protetor Solar',
      text:
        `🔥 *OFERTA ESPECIAL DA {farmacia}!* ☀️\n\n` +
        `Olá, {nome}! O sol está forte e sua pele precisa de proteção máxima.\n\n` +
        `Nesta semana, nossa linha de *Protetores Solares e Hidratantes Faciais* está com até *30% de desconto*!\n\n` +
        `👉 Quer garantir o seu ou consultar marcas em estoque?\n` +
        `Responda *1* ou envie sua mensagem aqui que separamos para você! 🛵 Entregamos rapidinho no seu endereço.`,
    },
    {
      title: '👶 Semana do Bebê & Fraldas',
      text:
        `🍼 *SEMANA DA MAMÃE E DO BEBÊ NA {farmacia}!* 👶\n\n` +
        `Oi, {nome}! Chegou carregamento novo de fraldas, pomadas contra assaduras e lencinhos umedecidos com preço de custo!\n\n` +
        `📦 Compre 2 pacotes e ganhe entrega grátis no seu bairro.\n\n` +
        `👉 Deseja que eu envie a tabela de tamanhos (P, M, G, XG)?\n` +
        `Basta responder esta mensagem!`,
    },
    {
      title: '🍊 Vitaminas & Imunidade',
      text:
        `💪 *CUIDE DA SUA SAÚDE & IMUNIDADE!* 🍊\n\n` +
        `Olá, {nome}! Com a mudança de tempo, fortalecer as defesas do organismo é essencial.\n\n` +
        `Estamos com promoção especial em *Vitamina C + Zinco, Ômega 3 e Complexo B*!\n\n` +
        `👉 Peça agora pelo WhatsApp e receba em casa com agilidade da *{farmacia}*. Responda *1* para fazer seu pedido!`,
    },
    {
      title: '💊 Medicamentos de Uso Contínuo & Genéricos',
      text:
        `🩺 *LEMBRETE DE SAÚDE - {farmacia}* 💊\n\n` +
        `Olá, {nome}! Como está o seu estoque de medicamentos deste mês?\n\n` +
        `Aqui na farmácia cobrimos ofertas em medicamentos genéricos e similares com descontos de até 50%!\n\n` +
        `📸 Envie a foto da sua caixinha ou receita que calculamos o melhor valor para você na hora!`,
    },
  ];

  // Load leads and past campaigns
  const loadData = async () => {
    if (!tenant?.id) return;
    setLoadingLeads(true);
    setLoadingCampaigns(true);
    try {
      const [leadsRes, campRes] = await Promise.all([
        api.getCampaignLeads(tenant.id),
        api.getCampaigns(tenant.id),
      ]);
      setLeadsData(leadsRes || { total_available: 0, total_opt_out: 0, leads: [] });
      setCampaignsList(campRes || []);

      // Check if any campaign is currently running
      const running = campRes?.find((c) => c.status === 'running');
      if (running) {
        setActiveCampaign(running);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de campanhas:', err);
    } finally {
      setLoadingLeads(false);
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    loadData();
    if (tenant?.phone) {
      setTestPhone(tenant.phone);
    }
  }, [tenant?.id]);

  // Lead Audience Counts
  const totalAvailable = leadsData.total_available || 0;
  const chatCount = (leadsData.leads || []).filter((l) => l.source === 'chat').length;
  const orderCount = (leadsData.leads || []).filter((l) => l.source === 'order').length;
  const manualCount = (leadsData.leads || []).filter(
    (l) => l.source === 'manual' || l.source === 'import'
  ).length;

  // Selected recipient count based on active targetAudience
  const getRecipientCount = () => {
    if (targetAudience === 'all') return totalAvailable;
    if (targetAudience === 'chat') return chatCount;
    if (targetAudience === 'order') return orderCount;
    if (targetAudience === 'manual') return manualCount;
    if (targetAudience === 'selected') return selectedPhones.size;
    return totalAvailable;
  };

  // Toggle phone selection
  const toggleSelectPhone = (phone) => {
    const clean = String(phone).replace(/\D/g, '');
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) {
        next.delete(clean);
      } else {
        next.add(clean);
      }
      return next;
    });
  };

  // Select all filtered leads
  const handleSelectAllFiltered = () => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      filteredLeads.forEach((l) => {
        const clean = l.clean_phone || l.phone.replace(/\D/g, '');
        if (clean) next.add(clean);
      });
      return next;
    });
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedPhones(new Set());
  };

  // Handle Image Selection from PC or Mobile Camera
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImage(file, 1200, 0.82);
      setImagePreview(compressedDataUrl);
    } catch (err) {
      alert('Erro ao carregar e compactar imagem: ' + err.message);
    }
  };

  // Build full message with opt-out footer if enabled
  const getFullMessage = () => {
    let base = message.trim();
    if (includeOptOut && base) {
      base += '\n\n_(Para não receber mais novidades ou ofertas, responda *PARAR*)_';
    }
    return base;
  };

  // Preview text for WhatsApp mockup
  const getPreviewText = () => {
    const raw = getFullMessage() || 'Escreva sua mensagem ao lado para visualizar a prévia instantânea...';
    return raw
      .replace(/{nome}/gi, 'Rozana')
      .replace(/{cliente}/gi, 'Rozana')
      .replace(/{farmacia}/gi, tenant?.name || 'Farmácia Central')
      .replace(/{data}/gi, new Date().toLocaleDateString('pt-BR'));
  };

  // Send single test broadcast
  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      alert('Informe um número de telefone com DDD para testar.');
      return;
    }
    if (!message.trim()) {
      alert('Escreva a mensagem da promoção antes de testar.');
      return;
    }

    setTestingSend(true);
    setTestSuccess(false);
    try {
      const res = await api.testCampaignMessage({
        tenant_id: tenant.id,
        phone: testPhone.trim(),
        message: getFullMessage(),
        image_url: imagePreview,
      });

      if (res.error) throw new Error(res.error);
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 4000);
    } catch (err) {
      alert('Erro ao enviar teste: ' + err.message);
    } finally {
      setTestingSend(false);
    }
  };

  // Start campaign
  const handleStartCampaign = async (e) => {
    e.preventDefault();
    if (whatsappStatus?.status !== 'connected') {
      alert('Conecte o WhatsApp da farmácia antes de iniciar uma campanha.');
      if (onNavigateTab) onNavigateTab('whatsapp');
      return;
    }

    if (!title.trim()) {
      alert('Dê um título interno para identificar esta campanha.');
      return;
    }
    if (!message.trim()) {
      alert('Escreva o texto da promoção.');
      return;
    }

    const recipientCount = getRecipientCount();
    if (recipientCount === 0) {
      if (targetAudience === 'selected') {
        alert(
          'Você escolheu a opção "Contatos Selecionados", mas não marcou nenhum cliente na lista. Vá na aba "Gerenciar Leads" e marque as caixas de seleção dos clientes desejados.'
        );
      } else {
        alert('Nenhum contato encontrado para o público-alvo selecionado.');
      }
      return;
    }

    let audienceLabel = 'todos os clientes da base';
    if (targetAudience === 'chat') audienceLabel = 'os clientes do Chat';
    if (targetAudience === 'order') audienceLabel = 'os clientes que já fizeram Pedidos';
    if (targetAudience === 'manual') audienceLabel = 'os contatos adicionados/importados';
    if (targetAudience === 'selected') audienceLabel = `os ${selectedPhones.size} contatos selecionados manualmente`;

    const confirmMsg = `Deseja realmente iniciar o disparo seguro para ${recipientCount} clientes (${audienceLabel})?\n\n- Intervalo: ~${delaySeconds} segundos entre mensagens\n- Imagem anexada: ${imagePreview ? 'SIM' : 'NÃO'}\n- Proteção anti-ban ativa: SIM`;
    if (!confirm(confirmMsg)) return;

    setStartingCampaign(true);
    try {
      const res = await api.createCampaign({
        tenant_id: tenant.id,
        title: title.trim(),
        message: getFullMessage(),
        image_url: imagePreview,
        delay_seconds: Number(delaySeconds) || 25,
        target_audience: targetAudience,
        selected_phones: targetAudience === 'selected' ? Array.from(selectedPhones) : [],
      });

      if (res.error) throw new Error(res.error);
      setActiveCampaign(res);
      // Clear draft since campaign has begun
      if (draftKey) localStorage.removeItem(draftKey);
      await loadData();
      alert('🚀 Campanha iniciada com sucesso! O sistema está processando a fila com segurança anti-ban.');
    } catch (err) {
      alert('Erro ao iniciar campanha: ' + err.message);
    } finally {
      setStartingCampaign(false);
    }
  };

  // Poll active campaign progress
  useEffect(() => {
    if (!activeCampaign || activeCampaign.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.getCampaignDetails(activeCampaign.id);
        if (res?.campaign) {
          setActiveCampaign(res.campaign);
          if (res.campaign.status !== 'running') {
            loadData();
          }
        }
      } catch (err) {
        console.error('Erro ao atualizar progresso:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeCampaign?.id, activeCampaign?.status]);

  const handlePause = async () => {
    if (!activeCampaign) return;
    try {
      await api.pauseCampaign(activeCampaign.id);
      setActiveCampaign({ ...activeCampaign, status: 'paused' });
      await loadData();
    } catch (err) {
      alert('Erro ao pausar: ' + err.message);
    }
  };

  const handleResume = async () => {
    if (!activeCampaign) return;
    try {
      await api.resumeCampaign(activeCampaign.id);
      setActiveCampaign({ ...activeCampaign, status: 'running' });
      await loadData();
    } catch (err) {
      alert('Erro ao retomar: ' + err.message);
    }
  };

  const handleCancel = async () => {
    if (!activeCampaign || !confirm('Deseja realmente cancelar esta campanha? Os envios restantes serão interrompidos.'))
      return;
    try {
      await api.cancelCampaign(activeCampaign.id);
      setActiveCampaign(null);
      await loadData();
    } catch (err) {
      alert('Erro ao cancelar: ' + err.message);
    }
  };

  // Add single lead
  const handleAddSingleLead = async (e) => {
    e.preventDefault();
    if (!newLeadPhone.trim()) {
      alert('Informe o WhatsApp do cliente com DDD.');
      return;
    }
    setSavingLead(true);
    try {
      const res = await api.addCampaignLead({
        tenant_id: tenant.id,
        phone: newLeadPhone.trim(),
        name: newLeadName.trim() || 'Cliente',
      });
      if (res.error) throw new Error(res.error);
      alert('✅ Contato adicionado com sucesso!');
      setNewLeadName('');
      setNewLeadPhone('');
      setShowAddLeadModal(false);
      await loadData();
    } catch (err) {
      alert('Erro ao adicionar contato: ' + err.message);
    } finally {
      setSavingLead(false);
    }
  };

  // Bulk import leads
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      alert('Cole a lista de contatos ou telefones no campo de texto.');
      return;
    }
    setImportingBulk(true);
    try {
      const res = await api.importCampaignLeads({
        tenant_id: tenant.id,
        raw_text: bulkText,
      });
      if (res.error) throw new Error(res.error);
      alert(`✅ ${res.message || 'Contatos importados com sucesso!'}`);
      setBulkText('');
      setShowBulkModal(false);
      await loadData();
    } catch (err) {
      alert('Erro na importação: ' + err.message);
    } finally {
      setImportingBulk(false);
    }
  };

  // Delete single lead
  const handleDeleteLead = async (lead) => {
    if (
      !confirm(
        `Remover ${lead.name || 'este contato'} (${lead.phone}) dos disparos da farmácia?\nEle também será marcado para não receber propagandas.`
      )
    ) {
      return;
    }
    try {
      const res = await api.deleteCampaignLead(tenant.id, lead.phone);
      if (res.error) throw new Error(res.error);
      await loadData();
    } catch (err) {
      alert('Erro ao remover contato: ' + err.message);
    }
  };

  // Filtered leads
  const filteredLeads = (leadsData.leads || []).filter((lead) => {
    const term = leadSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (lead.name && lead.name.toLowerCase().includes(term)) ||
      (lead.phone && lead.phone.includes(term)) ||
      (lead.clean_phone && lead.clean_phone.includes(term));

    const matchesSource =
      leadSourceFilter === 'all' ||
      (leadSourceFilter === 'chat' && lead.source === 'chat') ||
      (leadSourceFilter === 'order' && lead.source === 'order') ||
      (leadSourceFilter === 'manual' && (lead.source === 'manual' || lead.source === 'import'));

    return matchesSearch && matchesSource;
  });

  // Calculate parsed numbers preview for bulk textarea
  const countDetectedPhonesInBulk = () => {
    if (!bulkText.trim()) return 0;
    const lines = bulkText.split(/\r?\n/);
    let count = 0;
    for (const l of lines) {
      const digits = l.replace(/\D/g, '');
      if (digits.length >= 10) count++;
    }
    return count;
  };

  const isConnected = whatsappStatus?.status === 'connected';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Megaphone size={14} className="text-emerald-400" />
              <span>Marketing & Campanhas no WhatsApp</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Disparos Automáticos de Ofertas & Fotos
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Divulgue medicamentos isentos, dermocosméticos e encartes semanais para os clientes da sua farmácia com
              upload direto do celular ou PC e <strong className="text-emerald-300">proteção anti-bloqueio avançada</strong>.
            </p>
          </div>

          {/* WhatsApp Status Badge */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shrink-0 flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                isConnected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-amber-500 text-white'
              }`}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs font-bold">
                  {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {isConnected ? 'Pronto para disparar' : 'Requer conexão no menu'}
              </p>
            </div>
            {!isConnected && onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('whatsapp')}
                className="ml-2 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-xs rounded-xl transition-all"
              >
                Conectar
              </button>
            )}
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10 text-xs">
          <div
            onClick={() => setActiveSection('leads')}
            className="bg-white/5 hover:bg-white/10 rounded-2xl p-3 border border-white/10 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-300 mb-1">
              <Users size={14} className="text-emerald-400" />
              <span>Clientes na Base</span>
            </div>
            <p className="text-xl font-extrabold text-white">
              {loadingLeads ? '...' : totalAvailable}
            </p>
            <span className="text-[10px] text-emerald-300 flex items-center gap-1 mt-0.5">
              Ver ou Adicionar Contatos →
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 text-slate-300 mb-1">
              <ShieldCheck size={14} className="text-teal-400" />
              <span>Anti-Ban Seguro</span>
            </div>
            <p className="text-xl font-extrabold text-teal-300">Ativo</p>
            <span className="text-[10px] text-slate-400">Delay humano 20s-40s</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 text-slate-300 mb-1">
              <XCircle size={14} className="text-rose-400" />
              <span>Descadastrados (PARAR)</span>
            </div>
            <p className="text-xl font-extrabold text-rose-300">
              {loadingLeads ? '...' : leadsData.total_opt_out}
            </p>
            <span className="text-[10px] text-slate-400">Garantia anti-denúncia</span>
          </div>

          <div
            onClick={() => setActiveSection('history')}
            className="bg-white/5 hover:bg-white/10 rounded-2xl p-3 border border-white/10 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-300 mb-1">
              <CheckCircle2 size={14} className="text-amber-400" />
              <span>Campanhas Criadas</span>
            </div>
            <p className="text-xl font-extrabold text-amber-300">{campaignsList.length}</p>
            <span className="text-[10px] text-amber-200/80 flex items-center gap-1 mt-0.5">
              Ver Histórico Completo →
            </span>
          </div>
        </div>
      </div>

      {/* Responsive Section Switcher (Sub-tabs for seamless mobile & desktop experience) */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto scrollbar-none shadow-inner border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSection('builder')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSection === 'builder'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Megaphone size={15} className={activeSection === 'builder' ? 'text-emerald-600' : 'text-slate-400'} />
          <span>Montar Campanha & Oferta</span>
          {(title || message || imagePreview) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Rascunho ativo" />
          )}
        </button>

        {/* Preview Tab (Extra useful on mobile) */}
        <button
          type="button"
          onClick={() => setActiveSection('preview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSection === 'preview'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Eye size={15} className={activeSection === 'preview' ? 'text-emerald-600' : 'text-slate-400'} />
          <span>Prévia no WhatsApp</span>
          {imagePreview && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded-md font-mono">
              Foto Anexada
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('leads')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSection === 'leads'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users size={15} className={activeSection === 'leads' ? 'text-emerald-600' : 'text-slate-400'} />
          <span>Gerenciar Leads & Contatos</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
            {totalAvailable}
          </span>
          {selectedPhones.size > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-bold animate-pulse">
              {selectedPhones.size} selecionados
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSection === 'history'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Clock size={15} className={activeSection === 'history' ? 'text-emerald-600' : 'text-slate-400'} />
          <span>Histórico de Disparos</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
            {campaignsList.length}
          </span>
        </button>
      </div>

      {/* Active Campaign Live Monitor (If running) */}
      {activeCampaign && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-md p-5 sm:p-6 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  activeCampaign.status === 'running'
                    ? 'bg-emerald-100 text-emerald-700 animate-pulse'
                    : activeCampaign.status === 'paused'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Megaphone size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-800">
                    Campanha em Andamento: {activeCampaign.title}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeCampaign.status === 'running'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeCampaign.status === 'paused'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {activeCampaign.status === 'running'
                      ? '● Enviando...'
                      : activeCampaign.status === 'paused'
                      ? 'Pausada'
                      : 'Concluída'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Enviando de 1 em 1 com intervalo de segurança anti-ban para proteger seu chip.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeCampaign.status === 'running' ? (
                <button
                  type="button"
                  onClick={handlePause}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center gap-1.5 transition-colors"
                >
                  <Pause size={13} /> Pausar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResume}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 transition-colors"
                >
                  <Play size={13} /> Retomar
                </button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1.5 transition-colors"
              >
                <XCircle size={13} /> Cancelar
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span>
                Progresso: {activeCampaign.sent_count} de {activeCampaign.total_leads} clientes
              </span>
              <span>
                {Math.round(
                  ((activeCampaign.sent_count + activeCampaign.failed_count) / (activeCampaign.total_leads || 1)) * 100
                )}
                %
              </span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    ((activeCampaign.sent_count + activeCampaign.failed_count) / (activeCampaign.total_leads || 1)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: BUILDER & LIVE PREVIEW */}
      {activeSection === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Builder Form */}
          <div className="lg:col-span-7 space-y-6">
            <form
              onSubmit={handleStartCampaign}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-5"
            >
              {/* Form Header with Draft Notice & Reset */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Criar Nova Campanha de Oferta</h2>
                  <p className="text-xs text-slate-500">
                    Foto do produto, texto promocional e agendamento seguro
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(title || message || imagePreview) && (
                    <>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                        <Check size={12} /> Salvo automaticamente
                      </span>
                      <button
                        type="button"
                        onClick={handleClearDraft}
                        className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-[11px] font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                        title="Limpar formulário"
                      >
                        <RotateCcw size={12} /> Limpar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Step 1: Upload Imagem do Computador ou Celular */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>1. Foto ou Encarte da Oferta</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    (Opcional, mas atrai muito mais compras!)
                  </span>
                </label>

                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                    <img
                      src={imagePreview}
                      alt="Preview da Oferta"
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl bg-white border border-slate-200 shadow-xs shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-bold text-slate-800 truncate">Imagem Pronta para Envio</p>
                      <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Compactada com alta resolução (~150KB)
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                        Puxada diretamente da sua câmera, galeria ou computador sem lentidão no servidor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                      title="Remover Imagem"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/20 rounded-2xl p-5 text-center cursor-pointer transition-all group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      capture="environment"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                      <Upload size={22} />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Toque para escolher a foto do Celular ou Computador
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No celular abre a Câmera ou Galeria • No PC escolha qualquer PNG ou JPG
                    </p>
                  </div>
                )}
              </div>

              {/* Step 2: Título Interno */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  2. Nome da Campanha (Para seu controle interno) *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Oferta Fraldas Pampers - Terça-Feira"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Step 3: Modelos Prontos */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  3. Usar um Modelo de Mensagem Pronto (Opcional):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTitle(tmpl.title.replace(/^[^\w\s]+/, '').trim());
                        setMessage(tmpl.text);
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left font-medium text-slate-700 transition-colors truncate"
                    >
                      {tmpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Mensagem da Campanha */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">4. Texto da Mensagem *</label>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-400">Tags:</span>
                    <button
                      type="button"
                      onClick={() => setMessage((m) => m + ' {nome}')}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[10px]"
                    >
                      {'{nome}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessage((m) => m + ' {farmacia}')}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[10px]"
                    >
                      {'{farmacia}'}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={6}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escreva a oferta ou selecione um dos modelos acima... Dica: use {nome} para chamar o cliente pelo nome!"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400 mt-1">
                  <span>Caracteres digitados: {message.length}</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                    <input
                      type="checkbox"
                      checked={includeOptOut}
                      onChange={(e) => setIncludeOptOut(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Incluir aviso de descadastro "PARAR" (Garante segurança anti-ban)</span>
                  </label>
                </div>
              </div>

              {/* Step 5: PÚBLICO-ALVO / PARA QUEM ENVIAR? */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Target size={15} className="text-emerald-600" />
                    <span>5. Para Quem Enviar? (Escolha o Público-Alvo)</span>
                  </label>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {getRecipientCount()} destinatários
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Option 1: Todos */}
                  <div
                    onClick={() => setTargetAudience('all')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      targetAudience === 'all'
                        ? 'bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white/80 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      checked={targetAudience === 'all'}
                      onChange={() => setTargetAudience('all')}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div>
                      <p className="font-bold text-slate-800">🎯 Todos os Contatos ({totalAvailable})</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Envia para toda a base qualificada da farmácia</p>
                    </div>
                  </div>

                  {/* Option 2: Apenas Chat */}
                  <div
                    onClick={() => setTargetAudience('chat')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      targetAudience === 'chat'
                        ? 'bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white/80 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      checked={targetAudience === 'chat'}
                      onChange={() => setTargetAudience('chat')}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div>
                      <p className="font-bold text-slate-800">💬 Apenas Clientes do Chat ({chatCount})</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Quem já conversou pelo WhatsApp</p>
                    </div>
                  </div>

                  {/* Option 3: Apenas Pedidos */}
                  <div
                    onClick={() => setTargetAudience('order')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      targetAudience === 'order'
                        ? 'bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white/80 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      checked={targetAudience === 'order'}
                      onChange={() => setTargetAudience('order')}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div>
                      <p className="font-bold text-slate-800">🛍️ Apenas Quem Já Comprou ({orderCount})</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Clientes que já fizeram pedidos de entrega</p>
                    </div>
                  </div>

                  {/* Option 4: Apenas Importados/Manuais */}
                  <div
                    onClick={() => setTargetAudience('manual')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      targetAudience === 'manual'
                        ? 'bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white/80 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      checked={targetAudience === 'manual'}
                      onChange={() => setTargetAudience('manual')}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div>
                      <p className="font-bold text-slate-800">📥 Importados & Manuais ({manualCount})</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Contatos que você cadastrou ou colou na lista</p>
                    </div>
                  </div>
                </div>

                {/* Option 5: Contatos Marcados Manualmente */}
                <div
                  onClick={() => setTargetAudience('selected')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    targetAudience === 'selected'
                      ? 'bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-white/80 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="audience"
                      checked={targetAudience === 'selected'}
                      onChange={() => setTargetAudience('selected')}
                      className="text-emerald-600"
                    />
                    <div>
                      <p className="font-bold text-slate-800">
                        ☑️ Escolher Contatos Específicos ({selectedPhones.size} selecionados)
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Marque exatamente os clientes que deseja na lista de contatos
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetAudience('selected');
                      setActiveSection('leads');
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors whitespace-nowrap"
                  >
                    Marcar na Lista →
                  </button>
                </div>
              </div>

              {/* Step 6: Configuração Anti-Ban (Delay) */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock size={14} className="text-slate-500" />
                    Intervalo Seguro entre Mensagens:
                  </span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                    {delaySeconds} segundos (+ jitter aleatório)
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={60}
                  step={5}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  🛡️ O algoritmo adiciona variação humana aleatória para que nenhuma mensagem saia com tempo idêntico,
                  garantindo a reputação e saúde da sua conta de WhatsApp.
                </p>
              </div>

              {/* Mobile Shortcut to Preview */}
              <div className="lg:hidden">
                <button
                  type="button"
                  onClick={() => setActiveSection('preview')}
                  className="w-full py-2.5 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Eye size={15} />
                  <span>Ver Como Fica no WhatsApp do Cliente (Simulador)</span>
                </button>
              </div>

              {/* Botoes de Ação */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                {/* Envio de Teste */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Seu WhatsApp (DDD+Nº)"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full sm:w-40 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={testingSend}
                    onClick={handleSendTest}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 shrink-0 transition-all disabled:opacity-50"
                    title="Dispara um teste agora para o seu celular"
                  >
                    <Send size={13} className={testingSend ? 'animate-spin' : ''} />
                    <span>{testingSend ? 'Enviando...' : testSuccess ? '✅ Enviado!' : 'Testar no Meu Celular'}</span>
                  </button>
                </div>

                {/* Botão de Disparo Geral */}
                <button
                  type="submit"
                  disabled={startingCampaign || !isConnected || getRecipientCount() === 0}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Play size={14} />
                  <span>
                    {startingCampaign
                      ? 'Iniciando Campanha...'
                      : targetAudience === 'all'
                      ? `Disparar para Todos (${totalAvailable} Clientes)`
                      : targetAudience === 'chat'
                      ? `Disparar para ${chatCount} Clientes do Chat`
                      : targetAudience === 'order'
                      ? `Disparar para ${orderCount} Clientes de Pedidos`
                      : targetAudience === 'manual'
                      ? `Disparar para ${manualCount} Contatos da Lista`
                      : `Disparar para ${selectedPhones.size} Clientes Selecionados`}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT: Live Phone Mockup Preview (Always visible on desktop!) */}
          <div className="hidden lg:block lg:col-span-5 space-y-4">
            <div className="sticky top-20">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Eye size={14} className="text-emerald-600" />
                  Prévia ao Vivo no WhatsApp
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Simulador</span>
              </div>

              {/* Mockup Frame */}
              <div className="w-full max-w-sm mx-auto bg-slate-900 rounded-[36px] p-3.5 shadow-2xl border-4 border-slate-800">
                <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3" />

                <div className="bg-[#EFEAE2] rounded-[24px] overflow-hidden flex flex-col h-[520px] shadow-inner relative">
                  <div className="bg-[#075E54] text-white p-3 flex items-center gap-2.5 shrink-0 shadow-xs">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                      💊
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate leading-tight">
                        {tenant?.name || 'Farmácia Central'}
                      </p>
                      <p className="text-[9px] text-emerald-200">Online • Conta Comercial</p>
                    </div>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]">
                    <div className="text-center">
                      <span className="text-[9px] bg-white/80 text-slate-600 px-2 py-0.5 rounded-full shadow-2xs font-semibold">
                        HOJE
                      </span>
                    </div>

                    <div className="max-w-[92%] bg-[#D9FDD3] text-slate-800 rounded-2xl rounded-tr-xs p-2.5 shadow-xs space-y-2 ml-auto text-xs">
                      {imagePreview ? (
                        <div className="rounded-xl overflow-hidden bg-black/5">
                          <img
                            src={imagePreview}
                            alt="Oferta"
                            className="w-full max-h-52 object-cover rounded-xl"
                          />
                        </div>
                      ) : (
                        <div className="bg-emerald-900/5 rounded-xl p-5 text-center border border-dashed border-emerald-900/15">
                          <ImageIcon size={26} className="mx-auto text-emerald-700/40 mb-1" />
                          <span className="text-[10px] text-slate-500 font-medium">
                            Nenhuma foto anexada
                          </span>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap leading-relaxed text-[11px] font-sans break-words">
                        {getPreviewText()}
                      </div>

                      <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 pt-0.5">
                        <span>14:32</span>
                        <span className="text-[#53BDEB] font-bold">✓✓</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#F0F2F5] p-2 flex items-center gap-2 border-t border-slate-200 shrink-0">
                    <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-slate-400">
                      Mensagem
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#00A884] text-white flex items-center justify-center text-xs font-bold">
                      🎤
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: MOBILE-OPTIMIZED PREVIEW VIEW */}
      {activeSection === 'preview' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Simulador de Visualização</h2>
              <p className="text-xs text-slate-500">Veja exatamente como o cliente receberá sua oferta no celular</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('builder')}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <span>← Voltar para Edição</span>
            </button>
          </div>

          <div className="w-full max-w-sm mx-auto bg-slate-900 rounded-[36px] p-3.5 shadow-2xl border-4 border-slate-800">
            <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3" />

            <div className="bg-[#EFEAE2] rounded-[24px] overflow-hidden flex flex-col h-[520px] shadow-inner relative">
              <div className="bg-[#075E54] text-white p-3 flex items-center gap-2.5 shrink-0 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                  💊
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate leading-tight">
                    {tenant?.name || 'Farmácia Central'}
                  </p>
                  <p className="text-[9px] text-emerald-200">Online • Conta Comercial</p>
                </div>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]">
                <div className="text-center">
                  <span className="text-[9px] bg-white/80 text-slate-600 px-2 py-0.5 rounded-full shadow-2xs font-semibold">
                    HOJE
                  </span>
                </div>

                <div className="max-w-[92%] bg-[#D9FDD3] text-slate-800 rounded-2xl rounded-tr-xs p-2.5 shadow-xs space-y-2 ml-auto text-xs">
                  {imagePreview ? (
                    <div className="rounded-xl overflow-hidden bg-black/5">
                      <img
                        src={imagePreview}
                        alt="Oferta"
                        className="w-full max-h-52 object-cover rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="bg-emerald-900/5 rounded-xl p-5 text-center border border-dashed border-emerald-900/15">
                      <ImageIcon size={26} className="mx-auto text-emerald-700/40 mb-1" />
                      <span className="text-[10px] text-slate-500 font-medium">
                        Nenhuma foto anexada
                      </span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed text-[11px] font-sans break-words">
                    {getPreviewText()}
                  </div>

                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 pt-0.5">
                    <span>14:32</span>
                    <span className="text-[#53BDEB] font-bold">✓✓</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#F0F2F5] p-2 flex items-center gap-2 border-t border-slate-200 shrink-0">
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-slate-400">
                  Mensagem
                </div>
                <div className="w-7 h-7 rounded-full bg-[#00A884] text-white flex items-center justify-center text-xs font-bold">
                  🎤
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-sm mx-auto flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveSection('builder')}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl text-center transition-colors"
            >
              Editar Mensagem / Foto
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testingSend}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl text-center shadow-md shadow-emerald-600/20 transition-colors disabled:opacity-50"
            >
              {testingSend ? 'Enviando...' : 'Testar no Meu Celular'}
            </button>
          </div>
        </div>
      )}

      {/* SECTION 3: LEAD MANAGEMENT (GERENCIAR LEADS & CONTATOS) */}
      {activeSection === 'leads' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-6 animate-fade-in">
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">Base de Leads & Contatos da Farmácia</h2>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                  {totalAvailable} contatos disponíveis
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Marque clientes individualmente ou use os botões para adicionar e importar listas.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAddLeadModal(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all"
              >
                <UserPlus size={14} />
                <span>+ Adicionar Contato</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBulkModal(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-200 transition-all"
              >
                <FileSpreadsheet size={14} />
                <span>Importar em Massa</span>
              </button>

              <button
                type="button"
                onClick={loadData}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Atualizar lista"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Selection Banner if any leads are checked */}
          {selectedPhones.size > 0 && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2 text-xs text-emerald-900">
                <CheckSquare size={16} className="text-emerald-600 shrink-0" />
                <span className="font-bold">
                  {selectedPhones.size} contato{selectedPhones.size > 1 ? 's' : ''} selecionado{selectedPhones.size > 1 ? 's' : ''} para disparo específico.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                >
                  Desmarcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetAudience('selected');
                    setActiveSection('builder');
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span>Enviar Campanha para os {selectedPhones.size} →</span>
                </button>
              </div>
            </div>
          )}

          {/* Search, Filter & Bulk Selection Actions Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Buscar por nome ou telefone..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto overflow-x-auto">
              <span className="text-slate-400 text-[11px] font-semibold mr-1">Origem:</span>
              <button
                type="button"
                onClick={() => setLeadSourceFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  leadSourceFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todos ({totalAvailable})
              </button>
              <button
                type="button"
                onClick={() => setLeadSourceFilter('chat')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  leadSourceFilter === 'chat'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                💬 Chat ({chatCount})
              </button>
              <button
                type="button"
                onClick={() => setLeadSourceFilter('order')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  leadSourceFilter === 'order'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                🛍️ Pedidos ({orderCount})
              </button>
              <button
                type="button"
                onClick={() => setLeadSourceFilter('manual')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  leadSourceFilter === 'manual'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                ✍️ Importados ({manualCount})
              </button>
            </div>
          </div>

          {/* Quick Selection Buttons */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline"
              >
                Selecionar todos visíveis ({filteredLeads.length})
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-slate-500 hover:text-slate-700 hover:underline"
              >
                Limpar seleção
              </button>
            </div>

            <span className="text-[11px] text-slate-400">
              Total de leads na lista: {filteredLeads.length}
            </span>
          </div>

          {/* Leads Table / List with Checkboxes */}
          {loadingLeads ? (
            <div className="py-12 text-center text-xs text-slate-400">Carregando contatos e leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Users size={32} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-700">Nenhum contato encontrado nesta visualização</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                {leadSearch
                  ? 'Nenhum resultado corresponde à sua pesquisa.'
                  : 'Comece adicionando clientes manualmente ou importando uma lista em massa clicando nos botões acima.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredLeads.length > 0 &&
                          filteredLeads.every((l) =>
                            selectedPhones.has(l.clean_phone || l.phone.replace(/\D/g, ''))
                          )
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleSelectAllFiltered();
                          } else {
                            handleClearSelection();
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                        title="Marcar / Desmarcar todos visíveis"
                      />
                    </th>
                    <th className="p-3">Nome / Cliente</th>
                    <th className="p-3">WhatsApp</th>
                    <th className="p-3">Origem</th>
                    <th className="p-3">Data / Interação</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map((lead, idx) => {
                    const clean = lead.clean_phone || lead.phone.replace(/\D/g, '');
                    const isSelected = selectedPhones.has(clean);

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-slate-50/60'
                        }`}
                        onClick={() => toggleSelectPhone(lead.phone)}
                      >
                        <td
                          className="p-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectPhone(lead.phone)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0">
                              {(lead.name || 'C')[0].toUpperCase()}
                            </div>
                            <span className="truncate max-w-[180px]">{lead.name || 'Cliente'}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-700">
                          {formatPhone(lead.clean_phone || lead.phone)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              lead.source === 'chat'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : lead.source === 'order'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : lead.source === 'import'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {lead.source === 'chat'
                              ? '💬 Chat'
                              : lead.source === 'order'
                              ? '🛍️ Pedido'
                              : lead.source === 'import'
                              ? '📥 Importado'
                              : '✍️ Manual'}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-500">
                          {lead.last_interaction
                            ? new Date(lead.last_interaction).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td
                          className="p-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remover contato das listas de disparo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: CAMPAIGN HISTORY */}
      {activeSection === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800">Histórico de Campanhas Realizadas</h3>
              <p className="text-xs text-slate-500">Acompanhe os disparos anteriores e relatórios de entrega</p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
              title="Atualizar histórico"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {loadingCampaigns ? (
            <div className="py-12 text-center text-xs text-slate-400">Carregando histórico de campanhas...</div>
          ) : campaignsList.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
              Nenhuma campanha criada nesta farmácia ainda. Preencha a aba "Montar Campanha" e faça seu primeiro disparo!
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Campanha</th>
                    <th className="p-3">Foto</th>
                    <th className="p-3">Total Leads</th>
                    <th className="p-3">Enviados</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaignsList.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">
                        <div>
                          <span>{c.title}</span>
                          <p className="text-[10px] text-slate-400 font-normal line-clamp-1 max-w-xs">{c.message}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        {c.image_url ? (
                          <img
                            src={c.image_url}
                            alt="Thumb"
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400">Sem foto</span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-700">{c.total_leads}</td>
                      <td className="p-3">
                        <span className="font-bold text-emerald-600">{c.sent_count}</span>
                        {c.failed_count > 0 && (
                          <span className="ml-1 text-[10px] text-rose-500">({c.failed_count} falhas)</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'running'
                              ? 'bg-blue-100 text-blue-800 animate-pulse'
                              : c.status === 'paused'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.status === 'completed'
                            ? '✅ Concluída'
                            : c.status === 'running'
                            ? '⚡ Enviando...'
                            : c.status === 'paused'
                            ? '⏸️ Pausada'
                            : 'Cancelada'}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADICIONAR CONTATO INDIVIDUAL */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <UserPlus size={16} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Adicionar Contato de WhatsApp</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLeadModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSingleLead} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="Ex: Maria Silva (Opcional)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  WhatsApp (com DDD) *
                </label>
                <input
                  type="text"
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="Ex: 11 98888-7777 ou 11988887777"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  O sistema adiciona o código do país (+55) automaticamente se necessário.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {savingLead ? 'Salvando...' : 'Salvar Contato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: IMPORTAÇÃO EM MASSA (CSV / WHATSAPP / EXCEL) */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Importar Contatos em Massa</h3>
                  <p className="text-[11px] text-slate-400">Cole números do WhatsApp, Excel ou Bloco de Notas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBulkImport} className="space-y-3.5">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl text-[11px] text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles size={13} className="text-emerald-600" />
                  Formatos Aceitos Automaticamente:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  <li>Apenas números de telefone (um por linha): <span className="font-mono">11988887777</span></li>
                  <li>Nome e Telefone: <span className="font-mono">Maria Silva, 11988887777</span></li>
                  <li>Telefone e Nome: <span className="font-mono">11988887777; João Santos</span></li>
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Cole sua lista abaixo *</label>
                  <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-lg">
                    {countDetectedPhonesInBulk()} contatos detectados
                  </span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`11988887777\n11977776666\nMaria Silva, 11999998888\nJoão Ferreira; 21988881234`}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={importingBulk || countDetectedPhonesInBulk() === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {importingBulk
                    ? 'Importando...'
                    : `Importar ${countDetectedPhonesInBulk()} Contatos`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
