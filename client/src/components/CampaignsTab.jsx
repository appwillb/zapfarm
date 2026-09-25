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
  QrCode,
  Info,
  Check,
  Eye,
} from 'lucide-react';
import { api } from '../api';

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
  const [leadsData, setLeadsData] = useState({ total_available: 0, total_opt_out: 0, leads: [] });
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [campaignsList, setCampaignsList] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [includeOptOut, setIncludeOptOut] = useState(true);
  const [delaySeconds, setDelaySeconds] = useState(25);
  const [testPhone, setTestPhone] = useState(tenant?.phone || '');
  const [testingSend, setTestingSend] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [startingCampaign, setStartingCampaign] = useState(false);

  // Live active campaign tracking
  const [activeCampaign, setActiveCampaign] = useState(null);

  const fileInputRef = useRef(null);

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
    if (leadsData.total_available === 0) {
      alert('Nenhum cliente disponível na base desta farmácia para disparo.');
      return;
    }

    const confirmMsg = `Deseja realmente iniciar o disparo seguro para ${leadsData.total_available} clientes?\n\n- Intervalo: ~${delaySeconds} segundos entre mensagens\n- Imagem anexada: ${imagePreview ? 'SIM' : 'NÃO'}\n- Proteção anti-ban ativa: SIM`;
    if (!confirm(confirmMsg)) return;

    setStartingCampaign(true);
    try {
      const res = await api.createCampaign({
        tenant_id: tenant.id,
        title: title.trim(),
        message: getFullMessage(),
        image_url: imagePreview,
        delay_seconds: Number(delaySeconds) || 25,
      });

      if (res.error) throw new Error(res.error);
      setActiveCampaign(res);
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

  const isConnected = whatsappStatus?.status === 'connected';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Megaphone size={14} className="text-emerald-400" />
              <span>Marketing & Campanhas no WhatsApp</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Disparos Automáticos de Ofertas & Fotos
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
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
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 text-slate-300 mb-1">
              <Users size={14} className="text-emerald-400" />
              <span>Clientes na Base</span>
            </div>
            <p className="text-xl font-extrabold text-white">
              {loadingLeads ? '...' : leadsData.total_available}
            </p>
            <span className="text-[10px] text-slate-400">Contatos quentes da farmácia</span>
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

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 text-slate-300 mb-1">
              <CheckCircle2 size={14} className="text-amber-400" />
              <span>Campanhas Criadas</span>
            </div>
            <p className="text-xl font-extrabold text-amber-300">{campaignsList.length}</p>
            <span className="text-[10px] text-slate-400">Total histórico</span>
          </div>
        </div>
      </div>

      {/* Active Campaign Live Monitor (If running) */}
      {activeCampaign && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-md p-6 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
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
                  Enviando de 1 em 1 com intervalo de segurança anti-ban para proteger o chip.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeCampaign.status === 'running' ? (
                <button
                  type="button"
                  onClick={handlePause}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center gap-1.5"
                >
                  <Pause size={13} /> Pausar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResume}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5"
                >
                  <Play size={13} /> Retomar
                </button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1.5"
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

      {/* Main Grid: Form Builder (Left) & WhatsApp Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Campaign Builder Form */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleStartCampaign}
            className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800">Criar Nova Campanha de Oferta</h2>
                <p className="text-xs text-slate-500">Configure a foto do produto, texto e agendamento seguro</p>
              </div>
              <span className="text-xs text-indigo-600 bg-indigo-50 font-bold px-3 py-1 rounded-full border border-indigo-100">
                Passo a Passo
              </span>
            </div>

            {/* Step 1: Upload Imagem do Computador ou Celular */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>1. Foto ou Banner do Produto / Oferta</span>
                <span className="text-[11px] font-normal text-slate-400">
                  (Opcional, mas aumenta muito as vendas!)
                </span>
              </label>

              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex items-center gap-3">
                  <img
                    src={imagePreview}
                    alt="Preview da Oferta"
                    className="w-20 h-20 object-cover rounded-xl bg-white border border-slate-200 shadow-xs"
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-bold text-slate-800 truncate">Imagem Pronta para Envio</p>
                    <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Compactada com alta nitidez (~150KB)
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Enviada diretamente pelo WhatsApp sem sobrecarregar o servidor.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Remover Imagem"
                  >
                    <Trash2 size={16} />
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
                    Clique aqui para selecionar do Celular ou Computador
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No celular abre a Galeria ou Câmera • No PC selecione qualquer PNG ou JPG
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Título Interno */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                2. Nome da Campanha (Uso Interno) *
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
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTitle(tmpl.title.replace(/^[^\w\s]+/, '').trim());
                      setMessage(tmpl.text);
                    }}
                    className="p-2 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left font-medium text-slate-700 transition-colors truncate"
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
                placeholder="Escreva a oferta ou selecione um dos modelos acima... Use {nome} para o nome do cliente."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Caracteres: {message.length}</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={includeOptOut}
                    onChange={(e) => setIncludeOptOut(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Incluir aviso de descadastro "PARAR" (Anti-Ban)</span>
                </label>
              </div>
            </div>

            {/* Step 5: Configuração Anti-Ban (Delay) */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-500" />
                  Intervalo Inteligente entre Mensagens:
                </span>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                  {delaySeconds} segundos (+ randomização)
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
                garantindo a segurança do seu WhatsApp.
              </p>
            </div>

            {/* Aviso Anvisa */}
            <div className="flex items-start gap-2 p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-[11px] text-amber-800 leading-relaxed">
              <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Regulamentação Anvisa:</strong> Priorize campanhas de perfumaria, dermocosméticos, produtos de
                higiene, suplementos/vitaminas e remédios isentos de receita médica (MIPs).
              </span>
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
                  className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full sm:w-36 font-mono text-[11px]"
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
                disabled={startingCampaign || !isConnected || leadsData.total_available === 0}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Play size={14} />
                <span>
                  {startingCampaign
                    ? 'Iniciando Campanha...'
                    : `Disparar para ${leadsData.total_available} Clientes`}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: WhatsApp Mockup Live Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Eye size={14} className="text-emerald-600" />
                Prévia ao Vivo no WhatsApp do Cliente
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Simulador</span>
            </div>

            {/* Mockup Frame */}
            <div className="w-full max-w-sm mx-auto bg-slate-900 rounded-[36px] p-3.5 shadow-2xl border-4 border-slate-800">
              {/* Phone Speaker Notch */}
              <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3" />

              {/* WhatsApp Chat Window */}
              <div className="bg-[#EFEAE2] rounded-[24px] overflow-hidden flex flex-col h-[520px] shadow-inner relative">
                {/* WhatsApp Chat Header */}
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

                {/* WhatsApp Chat Body */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]">
                  {/* Date badge */}
                  <div className="text-center">
                    <span className="text-[9px] bg-white/80 text-slate-600 px-2 py-0.5 rounded-full shadow-2xs font-semibold">
                      HOJE
                    </span>
                  </div>

                  {/* Message Balloon */}
                  <div className="max-w-[92%] bg-[#D9FDD3] text-slate-800 rounded-2xl rounded-tr-xs p-2.5 shadow-xs space-y-2 ml-auto text-xs">
                    {/* Image Preview inside balloon */}
                    {imagePreview ? (
                      <div className="rounded-xl overflow-hidden bg-black/5">
                        <img
                          src={imagePreview}
                          alt="Oferta"
                          className="w-full max-h-52 object-cover rounded-xl"
                        />
                      </div>
                    ) : (
                      <div className="bg-emerald-900/5 rounded-xl p-6 text-center border border-dashed border-emerald-900/15">
                        <ImageIcon size={28} className="mx-auto text-emerald-700/40 mb-1" />
                        <span className="text-[10px] text-slate-500 font-medium">
                          Nenhuma foto selecionada ainda
                        </span>
                      </div>
                    )}

                    {/* Caption / Text */}
                    <div className="whitespace-pre-wrap leading-relaxed text-[11px] font-sans break-words">
                      {getPreviewText()}
                    </div>

                    {/* Time & Double Blue Checks */}
                    <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 pt-0.5">
                      <span>14:32</span>
                      <span className="text-[#53BDEB] font-bold">✓✓</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Footer Bar */}
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

      {/* Histórico de Campanhas Anteriores */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Histórico de Campanhas Realizadas</h3>
            <p className="text-xs text-slate-500">Acompanhe os disparos anteriores e métricas de entrega</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            title="Atualizar histórico"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {loadingCampaigns ? (
          <div className="py-8 text-center text-xs text-slate-400">Carregando histórico de campanhas...</div>
        ) : campaignsList.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
            Nenhuma campanha criada nesta farmácia ainda. Preencha o formulário acima e faça seu primeiro disparo!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Campanha</th>
                  <th className="p-3">Foto</th>
                  <th className="p-3">Total de Leads</th>
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
                          className="w-9 h-9 object-cover rounded-lg border border-slate-200"
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
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                    <td className="p-3 text-[11px] text-slate-500">
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
    </div>
  );
}
