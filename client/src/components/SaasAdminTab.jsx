import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Users,
  CreditCard,
  ShieldCheck,
  Check,
  AlertCircle,
  Edit2,
  Trash2,
  KeyRound,
  Mail,
  Lock,
  User,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Phone,
  FileText,
} from 'lucide-react';
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
    logo_url: '',
    delivery_fee_default: '7.00',
    address: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // User modal state (Create / Edit)
  const [editUserModal, setEditUserModal] = useState({ open: false, user: null, isNew: false });
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    tenant_id: '',
    active: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(null);

  // Tenant edit modal state
  const [editTenantModal, setEditTenantModal] = useState({ open: false, tenant: null });
  const [tenantFormData, setTenantFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cnpj: '',
    plan: 'pro',
    pix_key: '',
    address: '',
    business_hours: '',
    delivery_fee_default: '7.00',
  });
  const [savingTenant, setSavingTenant] = useState(false);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadUsers(),
        onTenantCreated ? onTenantCreated() : Promise.resolve(),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    try {
      await api.createTenant(formData);
      alert('Nova farmácia cadastrada com sucesso! O acesso do cliente foi liberado com o e-mail e senha configurados.');
      setModalOpen(false);
      setFormData({
        name: '',
        slug: '',
        cnpj: '',
        phone: '',
        email: '',
        plan: 'pro',
        pix_key: '',
        logo_url: '',
        delivery_fee_default: '7.00',
        address: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
      });
      if (onTenantCreated) onTenantCreated();
      await loadUsers();
    } catch (err) {
      alert('Erro ao criar farmácia: ' + err.message);
    }
  };

  // Open Edit Tenant Modal
  const handleOpenEditTenant = (t) => {
    setTenantFormData({
      name: t.name || '',
      email: t.email || '',
      phone: t.phone || '',
      cnpj: t.cnpj || '',
      plan: t.plan || 'pro',
      pix_key: t.pix_key || '',
      address: t.address || '',
      business_hours: t.business_hours || '08:00 às 22:00',
      delivery_fee_default: t.delivery_fee_default || '7.00',
    });
    setEditTenantModal({ open: true, tenant: t });
  };

  // Save Tenant edits
  const handleSaveTenant = async (e) => {
    e.preventDefault();
    if (!editTenantModal.tenant) return;
    setSavingTenant(true);
    try {
      await api.updateTenant(editTenantModal.tenant.id, tenantFormData);
      alert('Dados e e-mail da farmácia atualizados com sucesso!');
      setEditTenantModal({ open: false, tenant: null });
      if (onTenantCreated) onTenantCreated();
    } catch (err) {
      alert('Erro ao atualizar farmácia: ' + err.message);
    } finally {
      setSavingTenant(false);
    }
  };

  // Open User Modal (New)
  const handleOpenNewUser = () => {
    setUserFormData({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      tenant_id: tenants[0]?.id ? String(tenants[0].id) : '',
      active: true,
    });
    setShowPassword(false);
    setEditUserModal({ open: true, user: null, isNew: true });
  };

  // Open User Modal (Edit Email / Password)
  const handleOpenEditUser = (user) => {
    setUserFormData({
      name: user.name || '',
      email: user.email || '',
      password: '', // blank by default unless admin wants to change
      role: user.role || 'admin',
      tenant_id: user.tenant_id ? String(user.tenant_id) : '',
      active: user.active !== 0,
    });
    setShowPassword(false);
    setEditUserModal({ open: true, user, isNew: false });
  };

  // Save User
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      if (editUserModal.isNew) {
        if (!userFormData.password) {
          alert('Por favor, informe a senha para o novo usuário.');
          setSavingUser(false);
          return;
        }
        await api.createUser({
          name: userFormData.name,
          email: userFormData.email,
          password: userFormData.password,
          role: userFormData.role,
          tenant_id: userFormData.role === 'superadmin' ? null : (userFormData.tenant_id ? Number(userFormData.tenant_id) : null),
        });
        alert('Usuário cadastrado com sucesso!');
      } else {
        await api.updateUser(editUserModal.user.id, {
          name: userFormData.name,
          email: userFormData.email,
          password: userFormData.password, // if blank, backend keeps current
          role: userFormData.role,
          tenant_id: userFormData.role === 'superadmin' ? null : (userFormData.tenant_id ? Number(userFormData.tenant_id) : null),
          active: userFormData.active ? 1 : 0,
        });
        alert('E-mail e dados do usuário atualizados com sucesso!');
      }
      setEditUserModal({ open: false, user: null, isNew: false });
      await loadUsers();
    } catch (err) {
      alert('Erro ao salvar usuário: ' + err.message);
    } finally {
      setSavingUser(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (user) => {
    if (!confirm(`Deseja realmente excluir o usuário "${user.name}" (${user.email})?`)) return;
    try {
      await api.deleteUser(user.id);
      alert('Usuário excluído com sucesso!');
      await loadUsers();
    } catch (err) {
      alert('Erro ao excluir usuário: ' + err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* SaaS Admin Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
              Master Superadmin
            </span>
            <h2 className="text-lg font-bold text-white">Painel do Dono da Plataforma SaaS</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Gerencie todas as farmácias clientes, e-mails de acesso, senhas dos administradores, planos e instâncias WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 transition-all shadow-xs"
            title="Atualizar dados do SaaS"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-400' : 'text-slate-300'} />
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 transition-all shadow-md shrink-0"
          >
            <Plus size={15} />
            Cadastrar Nova Farmácia
          </button>
        </div>
      </div>

      {/* SaaS Global Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Farmácias Ativas</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{tenants.length}</p>
          <p className="text-xs text-slate-400 mt-1">Tenants com banco isolado</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">MRR Estimado (Assinaturas)</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            R$ {(tenants.length * 397).toFixed(2)} / mês
          </p>
          <p className="text-xs text-slate-400 mt-1">Faturamento recorrente do SaaS</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Usuários & Administradores</span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{users.length} Contas</p>
          <p className="text-xs text-slate-400 mt-1">Logins com permissões ativas</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Sessões WhatsApp Baileys</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">{tenants.length} Instâncias</p>
          <p className="text-xs text-slate-400 mt-1">Multi-sessão nativa isolada</p>
        </div>
      </div>

      {/* SECTION 1: Users & Logins Management (Alterar E-mails e Senhas) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-800">Contas de Usuários & Credenciais de Acesso</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {users.length} usuários
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Altere e-mails de login, redefina senhas e controle os acessos de superadmins, farmacêuticos e atendentes.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenNewUser}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0"
          >
            <Plus size={14} />
            Novo Usuário
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nome / Usuário</th>
                <th className="py-3 px-4">E-mail de Acesso (Login)</th>
                <th className="py-3 px-4">Farmácia Vinculada</th>
                <th className="py-3 px-4">Perfil / Cargo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const roleBadge = {
                  superadmin: { label: '👑 Superadmin Global', color: 'bg-purple-100 text-purple-800 border-purple-200' },
                  admin: { label: 'Gerente / Dono Farmácia', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                  pharmacist: { label: 'Farmacêutica de Plantão', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                  attendant: { label: 'Atendente de Balcão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
                }[u.role] || { label: u.role, color: 'bg-slate-100 text-slate-700 border-slate-200' };

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name ? u.name.substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <p className="text-slate-800">{u.name}</p>
                          <span className="text-[10px] text-slate-400 font-normal">ID #{u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-slate-800 font-mono text-[11px] transition-colors border border-slate-200/60">
                        <Mail size={12} className="text-slate-500" />
                        <span>{u.email}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(u.email)}
                          className="text-slate-400 hover:text-slate-700 ml-1"
                          title="Copiar e-mail"
                        >
                          {copiedEmail === u.email ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.role === 'superadmin' ? (
                        <span className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
                          👑 Acesso Global a Todas
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-700 font-medium">
                          {u.tenant_name || (u.tenant_id ? `Farmácia #${u.tenant_id}` : 'Sem farmácia')}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge.color}`}>
                        {roleBadge.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.active !== 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <Check size={11} />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditUser(u)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-all shadow-xs"
                          title="Alterar e-mail e senha deste usuário"
                        >
                          <Edit2 size={12} />
                          <span>Alterar E-mail / Senha</span>
                        </button>
                        {u.role !== 'superadmin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                            title="Excluir usuário"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Tenants Table (Farmácias Registradas) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800">Farmácias Registradas no SaaS</h3>
            <p className="text-xs text-slate-500">Total: {tenants.length} assinantes com banco de dados isolado</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Farmácia / Tenant</th>
                <th className="py-3 px-4">CNPJ</th>
                <th className="py-3 px-4">E-mail de Contato</th>
                <th className="py-3 px-4">Telefone WhatsApp</th>
                <th className="py-3 px-4">Plano SaaS</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {t.logo_url ? (
                          <img src={t.logo_url} alt="" className="w-full h-full object-contain p-0.5 bg-white" />
                        ) : (
                          <img src="/zapfarm-logo.png" alt="" className="w-full h-full object-contain p-0.5" />
                        )}
                      </div>
                      <div>
                        <p>{t.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">slug: {t.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{t.cnpj || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{t.email || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-600">{t.phone || '—'}</td>
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
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEditTenant(t)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-all shadow-xs ml-auto"
                      title="Editar dados cadastrais e e-mail da farmácia"
                    >
                      <Edit2 size={12} />
                      <span>Editar Farmácia</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Edit User (Alterar E-mail / Senha / Cargo) */}
      {editUserModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    {editUserModal.isNew ? 'Cadastrar Novo Usuário' : 'Alterar E-mail & Senha do Usuário'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editUserModal.isNew
                      ? 'Adicione uma nova conta de acesso à plataforma'
                      : `Editando: ${editUserModal.user?.name}`}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome Completo *</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dra. Camila ou Atendente Lucas"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  E-mail de Acesso (Login) *
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="admin@zapfarm.com ou email@farmacia.com.br"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Este é o e-mail que o usuário deve digitar na tela de login para entrar.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {editUserModal.isNew ? 'Senha de Acesso *' : 'Nova Senha (Opcional)'}
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={editUserModal.isNew}
                    placeholder={
                      editUserModal.isNew
                        ? 'Defina a senha de acesso...'
                        : 'Deixe em branco para manter a senha atual'
                    }
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {!editUserModal.isNew && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Só preencha se desejar alterar a senha atual do usuário.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cargo / Perfil</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="superadmin">👑 Superadmin (Dono do SaaS)</option>
                    <option value="admin">Administrador da Farmácia</option>
                    <option value="pharmacist">Farmacêutica de Plantão</option>
                    <option value="attendant">Atendente de Balcão</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Farmácia Vinculada</label>
                  <select
                    disabled={userFormData.role === 'superadmin'}
                    value={userFormData.role === 'superadmin' ? '' : userFormData.tenant_id}
                    onChange={(e) => setUserFormData({ ...userFormData, tenant_id: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    {userFormData.role === 'superadmin' ? (
                      <option value="">Acesso Global (Todas)</option>
                    ) : (
                      tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditUserModal({ open: false, user: null, isNew: false })}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs disabled:opacity-50"
                >
                  {savingUser ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Tenant (Alterar Dados e E-mail da Farmácia) */}
      {editTenantModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    Editar Farmácia: {editTenantModal.tenant?.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Altere o nome fantasia, e-mail de contato, CNPJ e plano da farmácia
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveTenant} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome da Farmácia *</label>
                <input
                  type="text"
                  required
                  value={tenantFormData.name}
                  onChange={(e) => setTenantFormData({ ...tenantFormData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">E-mail de Contato *</label>
                  <input
                    type="email"
                    required
                    value={tenantFormData.email}
                    onChange={(e) => setTenantFormData({ ...tenantFormData, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Telefone WhatsApp</label>
                  <input
                    type="text"
                    value={tenantFormData.phone}
                    onChange={(e) => setTenantFormData({ ...tenantFormData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={tenantFormData.cnpj}
                    onChange={(e) => setTenantFormData({ ...tenantFormData, cnpj: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plano SaaS</label>
                  <select
                    value={tenantFormData.plan}
                    onChange={(e) => setTenantFormData({ ...tenantFormData, plan: e.target.value })}
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
                  value={tenantFormData.pix_key}
                  onChange={(e) => setTenantFormData({ ...tenantFormData, pix_key: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditTenantModal({ open: false, tenant: null })}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTenant}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs disabled:opacity-50"
                >
                  {savingTenant ? 'Gravando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cadastrar Nova Farmácia */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-800">Cadastrar Nova Farmácia no SaaS</h3>

            <form onSubmit={handleCreateTenant} className="space-y-3 text-xs">
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
                <label className="font-bold text-slate-700 block mb-1">Logotipo da Farmácia (URL ou Imagem)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://exemplo.com/logo.png"
                    value={formData.logo_url?.startsWith('data:') ? 'Imagem carregada via upload' : formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                  <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center shrink-0 border border-slate-200">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            if (ev.target?.result) setFormData({ ...formData, logo_url: ev.target.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-3">
                <p className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-600" />
                  Dados de Login do Proprietário / Farmacêutico
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nome do Responsável</label>
                    <input
                      type="text"
                      placeholder="Ex: Dr. Roberto / Gerente"
                      value={formData.admin_name}
                      onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">E-mail de Acesso (Login)</label>
                    <input
                      type="email"
                      placeholder="gerente@farmacia.com.br"
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Senha Inicial de Acesso</label>
                  <input
                    type="password"
                    placeholder="Defina a senha para o cliente acessar..."
                    value={formData.admin_password}
                    onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Esses dados serão utilizados pelo cliente para entrar exclusivamente na conta da farmácia dele.
                  </p>
                </div>
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
