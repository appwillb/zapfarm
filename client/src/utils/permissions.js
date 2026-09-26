// ZapFarm Role & Granular Permissions System

export const ROLE_DEFINITIONS = {
  pharmacist: {
    id: 'pharmacist',
    label: 'Farmacêutica / Administrador',
    shortLabel: 'Farmacêutica',
    description: 'Acesso total a configurações, chave Pix, faturamento, equipe e catálogo.',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: '👩‍⚕️',
  },
  cashier: {
    id: 'cashier',
    label: 'Operador(a) de Caixa',
    shortLabel: 'Caixa',
    description: 'Confirma comprovantes Pix/dinheiro, libera para motoboy e acompanha pedidos. Sem acesso a alterar chave Pix ou configurações.',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: '💳',
  },
  attendant: {
    id: 'attendant',
    label: 'Atendente de Balcão',
    shortLabel: 'Atendente',
    description: 'Focado em atendimento ao cliente no chat WhatsApp e consulta de remédios. Não confirma pagamentos nem despacha motoboy.',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: '💬',
  },
  custom: {
    id: 'custom',
    label: 'Personalizado',
    shortLabel: 'Personalizado',
    description: 'Permissões específicas customizadas para este membro da equipe.',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: '⚙️',
  },
  superadmin: {
    id: 'superadmin',
    label: 'Super Admin (Dono SaaS)',
    shortLabel: 'Dono SaaS',
    description: 'Acesso irrestrito master da plataforma.',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: '👑',
  },
};

export const PERMISSION_GROUPS = [
  {
    groupId: 'orders_cashier',
    title: 'Caixa, Pedidos & Balcão',
    icon: 'ShoppingBag',
    color: 'indigo',
    permissions: [
      {
        key: 'orders_view',
        label: 'Visualizar Pedidos & Kanban de Vendas',
        desc: 'Permite acompanhar os pedidos que chegam pelo WhatsApp ou balcão.',
      },
      {
        key: 'orders_confirm_payment',
        label: 'Confirmar Comprovante de Pagamento (Pix / Dinheiro)',
        desc: 'Libera o botão de confirmar o Pix real após checar na conta bancária.',
        highlightBadge: 'Função Caixa',
      },
      {
        key: 'orders_dispatch_driver',
        label: 'Liberar / Despachar para o Motoboy',
        desc: 'Libera o botão de selecionar o motoboy e colocar o pedido em rota.',
        highlightBadge: 'Função Caixa',
      },
      {
        key: 'orders_cancel',
        label: 'Cancelar Pedidos',
        desc: 'Permite cancelar pedidos inválidos ou desistências.',
      },
    ],
  },
  {
    groupId: 'chat',
    title: 'Atendimento & Chat WhatsApp',
    icon: 'MessageSquare',
    color: 'emerald',
    permissions: [
      {
        key: 'chat_access',
        label: 'Acessar Atendimento Humanizado & Chat ao Vivo',
        desc: 'Permite conversar em tempo real com os clientes pelo WhatsApp da farmácia.',
      },
    ],
  },
  {
    groupId: 'products_inventory',
    title: 'Catálogo de Remédios & Estoque',
    icon: 'Pill',
    color: 'teal',
    permissions: [
      {
        key: 'products_view',
        label: 'Consultar Remédios & Preços',
        desc: 'Permite buscar remédios e ver preços para informar clientes no balcão.',
      },
      {
        key: 'products_manage',
        label: 'Cadastrar e Alterar Preços / Produtos',
        desc: 'Permite criar remédios, mudar valores e desativar produtos.',
      },
      {
        key: 'inventory_manage',
        label: 'Gerenciar Lotes & Validade de Remédios',
        desc: 'Permite dar entrada em novos lotes e monitorar datas de vencimento.',
      },
    ],
  },
  {
    groupId: 'drivers',
    title: 'Entregadores (Motoboys)',
    icon: 'Bike',
    color: 'purple',
    permissions: [
      {
        key: 'drivers_manage',
        label: 'Cadastrar e Gerenciar Motoboys',
        desc: 'Permite adicionar entregadores, definir taxas e alterar dados de motoboys.',
      },
    ],
  },
  {
    groupId: 'marketing_bot',
    title: 'Marketing & Conexão WhatsApp',
    icon: 'Megaphone',
    color: 'amber',
    permissions: [
      {
        key: 'campaigns_access',
        label: 'Disparar Campanhas & Promoções em Massa',
        desc: 'Permite criar e enviar ofertas e encartes com fotos para os leads.',
      },
      {
        key: 'whatsapp_manage',
        label: 'Conectar / Desconectar o Robô WhatsApp (QR Code)',
        desc: 'Permite reiniciar a sessão do WhatsApp ou ler novo QR Code.',
      },
    ],
  },
  {
    groupId: 'management',
    title: 'Gestão da Farmácia & Chave Pix',
    icon: 'Shield',
    color: 'rose',
    permissions: [
      {
        key: 'financial_view',
        label: 'Visualizar Faturamento e Métricas Financeiras',
        desc: 'Permite ver o faturamento diário, acumulado e ticket médio.',
      },
      {
        key: 'settings_manage',
        label: 'Alterar Chave Pix e Dados Fiscais da Farmácia',
        desc: 'MUDANÇA CRÍTICA: protege a chave Pix de recebimento da farmácia.',
        critical: true,
      },
      {
        key: 'team_manage',
        label: 'Gerenciar Equipe, E-mails e Permissões',
        desc: 'Permite adicionar outros usuários ou alterar senhas de login.',
        critical: true,
      },
    ],
  },
];

// Returns the default permission map for any role
export function getDefaultPermissions(role) {
  if (role === 'superadmin' || role === 'admin' || role === 'pharmacist') {
    return {
      orders_view: true,
      orders_confirm_payment: true,
      orders_dispatch_driver: true,
      orders_cancel: true,
      chat_access: true,
      products_view: true,
      products_manage: true,
      inventory_manage: true,
      drivers_manage: true,
      campaigns_access: true,
      whatsapp_manage: true,
      financial_view: true,
      settings_manage: true,
      team_manage: true,
    };
  }

  if (role === 'cashier') {
    return {
      orders_view: true,
      orders_confirm_payment: true, // EXCLUSIVO CAIXA
      orders_dispatch_driver: true, // EXCLUSIVO CAIXA
      orders_cancel: true,
      chat_access: false,
      products_view: true, // consulta preços no balcão
      products_manage: false,
      inventory_manage: false,
      drivers_manage: true, // vê motoboys disponíveis
      campaigns_access: false,
      whatsapp_manage: false,
      financial_view: true, // vê faturamento do caixa
      settings_manage: false, // BLOQUEADO: não altera chave pix
      team_manage: false, // BLOQUEADO: não altera usuários
    };
  }

  // attendant
  return {
    orders_view: true,
    orders_confirm_payment: false, // apenas o caixa confirma
    orders_dispatch_driver: false, // apenas o caixa despacha
    orders_cancel: false,
    chat_access: true, // Foco em atendimento
    products_view: true, // consulta catálogo
    products_manage: false,
    inventory_manage: false,
    drivers_manage: false,
    campaigns_access: false,
    whatsapp_manage: false,
    financial_view: false,
    settings_manage: false,
    team_manage: false,
  };
}

// Check if user has permission
export function canUser(user, permKey) {
  if (!user) return false;
  // Superadmin and pharmacist/admin have unrestricted full access
  if (user.role === 'superadmin' || user.role === 'admin' || user.role === 'pharmacist') {
    return true;
  }

  if (user.permissions && typeof user.permissions === 'object') {
    if (user.permissions[permKey] !== undefined) {
      return Boolean(user.permissions[permKey]);
    }
  }

  // Fallback to role preset
  const defaults = getDefaultPermissions(user.role);
  return Boolean(defaults[permKey]);
}
