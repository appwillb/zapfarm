import React, { useState } from 'react';
import { Building2, Plus, Users, CreditCard, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { api } from '../api';

export default function SaasAdminTab({ tenants, onTenantCreated }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    cnpj: '',
    phone: '',
    email: '',
    plan: 'pro',
    pix_key: '',
    delivery_fee_default: '7.00',
    address: '',
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createTenant(formData);
      alert('Nova farmácia cadastrada com sucesso na plataforma SaaS!');
      setModalOpen(false);
      setFormData({
        name: '',
        slug: '',
        cnpj: '',
        phone: '',
        email: '',
        plan: 'pro',
        pix_key: '',
        delivery_fee_default: '7.00',
        address: '',
      });
      if (onTenantCreated) onTenantCreated();
    } catch (err) {
      alert('Erro ao criar farmácia: ' + err.message);
    }
  };

  const planPricing = {
    starter: { price: 'R$ 197/mês', limit: 'Até 1.000 msgs/mês' },
    pro: { price: 'R$ 397/mês', limit: 'Mensagens ilimitadas + Multi-motoboy' },
    enterprise: { price: 'R$ 897/mês', limit: 'Rede de Filiais + API Externa' },
  };

  return (
    <div className="space-y-6">
      {/* SaaS Admin Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
              Master Superadmin
            </span>
            <h2 className="text-lg font-bold text-white">Painel do Dono da Plataforma SaaS</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Gerencie todas as farmácias clientes do seu SaaS, assinaturas, isolamento de dados e limites de uso. A cobrança do SaaS é independente das vendas dos medicamentos.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 transition-all shadow-md shrink-0"
        >
          <Plus size={15} />
          Cadastrar Nova Farmácia
        </button>
      </div>

      {/* SaaS Global Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Farmácias Ativas</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{tenants.length}</p>
          <p className="text-xs text-slate-400 mt-1">Tenants com banco isolado</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">MRR Estimado (Assinaturas SaaS)</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            R$ {(tenants.length * 397).toFixed(2)} / mês
          </p>
          <p className="text-xs text-slate-400 mt-1">Faturamento recorrente da sua plataforma</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Sessões Baileys WhatsApp</span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{tenants.length} Instâncias</p>
          <p className="text-xs text-slate-400 mt-1">Multi-sessão nativa isolada</p>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Farmácias Registradas</h3>
          <span className="text-xs text-slate-500">Total: {tenants.length} assinantes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Farmácia / Tenant</th>
                <th className="py-3 px-4">CNPJ</th>
                <th className="py-3 px-4">Telefone / Contato</th>
                <th className="py-3 px-4">Plano SaaS</th>
                <th className="py-3 px-4">Situação da Conta</th>
                <th className="py-3 px-4">Data Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        ⚕️
                      </div>
                      <div>
                        <p>{t.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">slug: {t.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{t.cnpj || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-600">{t.phone || t.email || '—'}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                      {t.plan || 'pro'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <Check size={11} />
                      Ativo
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Tenant Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-800">Cadastrar Nova Farmácia no SaaS</h3>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome Fantasia da Farmácia *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Farmácia São Lucas"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]/g, '-');
                    setFormData({ ...formData, name, slug });
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Identificador Slug *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CNPJ</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone WhatsApp</label>
                  <input
                    type="text"
                    placeholder="5511999998888"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plano SaaS</label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="starter">Starter (R$ 197/mês)</option>
                    <option value="pro">Pro (R$ 397/mês)</option>
                    <option value="enterprise">Enterprise (R$ 897/mês)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chave Pix da Farmácia</label>
                <input
                  type="text"
                  placeholder="CNPJ, Chave aleatória ou E-mail da farmácia"
                  value={formData.pix_key}
                  onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Endereço da Farmácia</label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, cidade"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                >
                  Criar Farmácia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
