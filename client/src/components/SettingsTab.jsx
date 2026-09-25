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
} from 'lucide-react';
import { api } from '../api';

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
