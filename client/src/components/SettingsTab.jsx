import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle,
  DollarSign,
  Clock,
  Store,
  Upload,
  Image as ImageIcon,
  Trash2,
  Copy,
  Check,
  QrCode,
  Info,
  Sparkles,
  Volume2,
  VolumeX,
  Bell,
  Play,
} from 'lucide-react';
import { api } from '../api';
import {
  getAudioConfig,
  saveAudioConfig,
  testAudioAlert,
  testHumanRequestAlert,
  unlockAudio,
  requestNotificationPermission,
} from '../services/soundAlerts';

export default function SettingsTab({ tenant, onTenantUpdated }) {
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    cnpj: tenant?.cnpj || '',
    phone: tenant?.phone || '',
    email: tenant?.email || '',
    logo_url: tenant?.logo_url || '',
    pix_key: tenant?.pix_key || '',
    pix_type: tenant?.pix_type || 'cnpj',
    delivery_fee_default: tenant?.delivery_fee_default || 7.00,
    free_shipping_threshold: tenant?.free_shipping_threshold || 100.00,
    address: tenant?.address || '',
    business_hours: tenant?.business_hours || '08:00 às 22:00',
    welcome_message: tenant?.welcome_message || '',
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pixPreview, setPixPreview] = useState(null);
  const [testingPix, setTestingPix] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [audioConfig, setAudioConfig] = useState(getAudioConfig());
  const [testName, setTestName] = useState('Rozana');
  const [testingVoice, setTestingVoice] = useState(false);
  const [notifGranted, setNotifGranted] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  const handleUpdateAudioConfig = (patch) => {
    const updated = saveAudioConfig(patch);
    setAudioConfig(updated);
  };

  const handleTestVoice = (type = 'incoming') => {
    unlockAudio();
    setTestingVoice(true);
    if (type === 'human') {
      testHumanRequestAlert(testName || 'Rozana');
    } else {
      testAudioAlert(testName || 'Rozana');
    }
    setTimeout(() => setTestingVoice(false), 3000);
  };

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        cnpj: tenant.cnpj || '',
        phone: tenant.phone || '',
        email: tenant.email || '',
        logo_url: tenant.logo_url || '',
        pix_key: tenant.pix_key || '',
        pix_type: tenant.pix_type || 'cnpj',
        delivery_fee_default: tenant.delivery_fee_default ?? 7.00,
        free_shipping_threshold: tenant.free_shipping_threshold ?? 100.00,
        address: tenant.address || '',
        business_hours: tenant.business_hours || '08:00 às 22:00',
        welcome_message: tenant.welcome_message || '',
      });
    }
  }, [tenant]);

  // Handle Logo Upload via File Reader
  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem é muito grande. Escolha uma imagem de até 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (base64) {
        setFormData((prev) => ({ ...prev, logo_url: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTestPix = async () => {
    if (!formData.pix_key) {
      alert('Informe uma chave Pix antes de testar a geração.');
      return;
    }
    setTestingPix(true);
    try {
      const res = await api.previewPix(tenant.id, {
        pix_key: formData.pix_key,
        pix_type: formData.pix_type,
        amount: 10.00,
      });
      setPixPreview(res);
    } catch (err) {
      alert('Erro ao testar Pix: ' + err.message);
    } finally {
      setTestingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixPreview?.pix_code) return;
    navigator.clipboard.writeText(pixPreview.pix_code);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateTenant(tenant.id, formData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (onTenantUpdated) onTenantUpdated();
    } catch (err) {
      alert('Erro ao salvar configurações: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Configurações da Farmácia, Logotipo & Pix</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalize a identidade visual, dados de atendimento e chave Pix do robô WhatsApp.
            </p>
          </div>
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-fade-in">
              <CheckCircle size={14} /> Salvo com sucesso!
            </span>
          )}
        </div>

        {/* Section: Logotipo da Farmácia */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ImageIcon size={14} className="text-slate-500" />
            Logotipo & Identidade Visual da Farmácia
          </h3>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-5">
            {/* Logo Preview */}
            <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative group">
              {formData.logo_url ? (
                <img
                  src={formData.logo_url}
                  alt="Logotipo da Farmácia"
                  className="w-full h-full object-contain p-1.5"
                />
              ) : (
                <div className="text-center p-2">
                  <ImageIcon size={28} className="mx-auto text-slate-300 mb-1" />
                  <span className="text-[10px] text-slate-400 block font-medium">Sem Logo</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex-1 space-y-3 w-full">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Alterar Logotipo da Farmácia
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Esta logo será exibida no cabeçalho do sistema, no painel lateral e no atendimento.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs">
                  <Upload size={14} />
                  <span>Fazer Upload do Computador</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </label>

                {formData.logo_url && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logo_url: '' })}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-rose-200"
                  >
                    <Trash2 size={13} />
                    Remover Logo
                  </button>
                )}
              </div>

              {/* URL Alternative */}
              <div className="pt-2">
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Ou informe o Link direto (URL) da imagem:
                </label>
                <input
                  type="text"
                  placeholder="https://exemplo.com/logo-farmacia.png"
                  value={formData.logo_url?.startsWith('data:') ? '' : formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Dados da Farmácia */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Store size={14} className="text-slate-500" />
            Dados Cadastrais
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nome da Farmácia</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">CNPJ</label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">WhatsApp de Contato</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Horário de Funcionamento</label>
              <input
                type="text"
                value={formData.business_hours}
                onChange={(e) => setFormData({ ...formData, business_hours: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="font-bold text-slate-700 block mb-1">Endereço Completo do Estabelecimento</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Section 2: Pix & Finanças */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <DollarSign size={14} className="text-slate-500" />
              Pagamentos Pix & Chave de Recebimento
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <Sparkles size={11} /> Pix Copia e Cola Automático
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Chave Pix para Recebimento</label>
              <input
                type="text"
                placeholder={
                  formData.pix_type === 'phone'
                    ? 'Ex: (62) 99534-7257'
                    : formData.pix_type === 'cnpj'
                    ? 'Ex: 12.345.678/0001-90'
                    : formData.pix_type === 'cpf'
                    ? 'Ex: 123.456.789-00'
                    : formData.pix_type === 'email'
                    ? 'Ex: financeiro@suafarmacia.com.br'
                    : 'Cole a chave aleatória (EVP)'
                }
                value={formData.pix_key}
                onChange={(e) => {
                  setFormData({ ...formData, pix_key: e.target.value });
                  setPixPreview(null);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Tipo da Chave</label>
              <select
                value={formData.pix_type}
                onChange={(e) => {
                  setFormData({ ...formData, pix_type: e.target.value });
                  setPixPreview(null);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="cnpj">CNPJ</option>
                <option value="phone">Telefone (Celular com DDD)</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="random">Chave Aleatória (EVP)</option>
              </select>
            </div>
          </div>

          {/* Key Guidelines */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-[11px] text-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <Info size={13} />
              <span>Como o robô WhatsApp entrega o Pix:</span>
            </div>
            <p>
              • O robô envia o código Pix em uma <strong>mensagem individual exclusiva</strong> no WhatsApp. Dessa forma, seu cliente consegue <strong>copiar com apenas 1 toque</strong> e colar no app do banco sem misturar com textos.
            </p>
            <p>
              • {formData.pix_type === 'phone'
                ? 'Para telefones, o prefixo +55 do Brasil é aplicado automaticamente conforme a regra do Banco Central.'
                : formData.pix_type === 'cnpj'
                ? 'Para CNPJs, a pontuação é tratada automaticamente para garantir 100% de compatibilidade.'
                : formData.pix_type === 'cpf'
                ? 'Para CPFs, os dígitos são formatados conforme a especificação do Banco Central.'
                : 'A chave será inserida no padrão BR Code oficial.'}
            </p>
          </div>

          {/* Test Pix Generation Button & Result Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Testar Geração do Pix Copia e Cola</h4>
                <p className="text-[11px] text-slate-500">
                  Valide como o código é montado e copie para testar no aplicativo do seu banco agora mesmo.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestPix}
                disabled={testingPix || !formData.pix_key}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <QrCode size={13} />
                {testingPix ? 'Gerando...' : 'Gerar Código de Teste'}
              </button>
            </div>

            {pixPreview && (
              <div className="space-y-2 pt-2 border-t border-slate-200/70">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">
                    Chave Formatada pelo Bacen: <strong className="font-mono text-slate-900">{pixPreview.formatted_key}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 text-[11px] shadow-xs transition-colors"
                  >
                    {copiedPix ? <Check size={12} /> : <Copy size={12} />}
                    {copiedPix ? 'Copiado! ✅' : 'Copiar Código Pix'}
                  </button>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-[10px] break-all text-slate-800 select-all leading-tight">
                  {pixPreview.pix_code}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Taxa Padrão de Entrega (R$)</label>
              <input
                type="number"
                step="0.50"
                value={formData.delivery_fee_default}
                onChange={(e) => setFormData({ ...formData, delivery_fee_default: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Frete Grátis Acima de (R$)</label>
              <input
                type="number"
                step="1.00"
                value={formData.free_shipping_threshold}
                onChange={(e) => setFormData({ ...formData, free_shipping_threshold: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Mensagens do Robô */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock size={14} className="text-slate-500" />
            Mensagem de Boas-vindas do Robô
          </h3>
          <div className="text-xs">
            <textarea
              rows={3}
              value={formData.welcome_message}
              onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              placeholder="Olá! Bem-vindo à {nome}. Qual medicamento ou produto você procura hoje?"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Dica: Utilize <code>{'{nome}'}</code> para inserir o nome da farmácia automaticamente.
            </p>
          </div>
        </div>

        {/* Section 4: Alertas Sonoros e Chamada de Voz do Balcão */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Volume2 size={15} className="text-emerald-600" />
              Alerta Sonoro & Voz do Balcão (Atendimento WhatsApp)
            </h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ⚡ Exclusivo ZapFarm
            </span>
          </div>

          <div className="bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Anúncio Falado ao Receber Mensagens</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                  Quando um cliente mandar mensagem no WhatsApp, o computador do balcão emitirá uma campainha chamativa e <strong>falará o nome do cliente em voz alta</strong> (ex: <em>"Atenção! Cliente Rozana está chamando no WhatsApp"</em>). Isso permite que o atendente escute mesmo longe da tela.
                </p>
              </div>

              {/* Master Toggle */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={audioConfig.enabled}
                  onChange={(e) => handleUpdateAudioConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {audioConfig.enabled && (
              <div className="pt-3 border-t border-emerald-200/60 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Notification Mode */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Tipo de Alerta Sonoro
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateAudioConfig({ mode: 'voice_and_chime' })}
                        className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                          audioConfig.mode === 'voice_and_chime'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        🗣️ Voz + Toque
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateAudioConfig({ mode: 'chime_only' })}
                        className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                          audioConfig.mode === 'chime_only'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        🔔 Apenas Toque
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateAudioConfig({ mode: 'voice_only' })}
                        className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                          audioConfig.mode === 'voice_only'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        🗣️ Apenas Voz
                      </button>
                    </div>
                  </div>

                  {/* Volume Slider */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1.5">
                      <span>Volume do Alto-falante</span>
                      <span className="text-emerald-700 font-extrabold">{Math.round(audioConfig.volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={audioConfig.volume}
                      onChange={(e) => handleUpdateAudioConfig({ volume: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg mt-2"
                    />
                  </div>
                </div>

                {/* Interactive Voice Test Bar */}
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      Testar Voz Sintetizada com Nome do Cliente
                    </span>
                    <span className="text-[11px] text-slate-500">pt-BR Voz Nativa</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative flex-1 w-full">
                      <input
                        type="text"
                        value={testName}
                        onChange={(e) => setTestName(e.target.value)}
                        placeholder="Nome do cliente (ex: Rozana, Carlos, Dona Maria)"
                        className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={testingVoice}
                      onClick={() => handleTestVoice('incoming')}
                      className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 shrink-0"
                    >
                      <Play size={13} className={testingVoice ? 'animate-spin' : ''} />
                      <span>{testingVoice ? 'Reproduzindo...' : 'Testar Chamado Normal'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={testingVoice}
                      onClick={() => handleTestVoice('human')}
                      className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 shrink-0"
                      title="Testa o alerta urgente quando o cliente digita 'humano' ou 'atendente'"
                    >
                      <span>👨‍⚕️ Testar Pedido Atendente</span>
                    </button>
                  </div>
                </div>

                {/* Windows Desktop Notifications */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Bell size={13} className="text-slate-400" />
                    <span>Notificações na Área de Trabalho (Windows/Mac):</span>
                  </span>
                  {notifGranted ? (
                    <span className="text-emerald-700 font-bold bg-emerald-100/70 px-2.5 py-0.5 rounded-full text-[11px]">
                      ✅ Notificações Ativadas
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await requestNotificationPermission();
                        setNotifGranted(ok);
                      }}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      🔔 Clique aqui para Ativar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
}
