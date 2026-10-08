const API_BASE = '/api';

// Wrapper de fetch que injeta o token JWT em toda requisicao e
// trata sessao expirada (401/403) limpando o login salvo.
function authFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('zapfarm_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers }).then((r) => {
    if (r.status === 401) {
      // Sessao expirada ou invalida: limpa login local para forcar re-login
      localStorage.removeItem('zapfarm_token');
      localStorage.removeItem('zapfarm_user');
    }
    return r;
  });
}

export const api = {
  // Tenants
  getTenants: () => authFetch(`${API_BASE}/tenants`).then((r) => r.json()),
  getTenant: (id) => authFetch(`${API_BASE}/tenants/${id}`).then((r) => r.json()),
  updateTenant: (id, data) =>
    authFetch(`${API_BASE}/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  createTenant: (data) =>
    authFetch(`${API_BASE}/tenants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  previewPix: (id, data) =>
    authFetch(`${API_BASE}/tenants/${id}/preview-pix`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // Dashboard
  getDashboard: (tenantId) => authFetch(`${API_BASE}/dashboard/${tenantId}`).then((r) => r.json()),

  // Products
  getProducts: (tenantId, search = '', category = '', supplierId = '') => {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (supplierId) params.append('supplier_id', supplierId);
    return authFetch(`${API_BASE}/products?${params}`).then((r) => r.json());
  },
  createProduct: (data) =>
    authFetch(`${API_BASE}/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateProduct: (id, data) =>
    authFetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteProduct: (id) => authFetch(`${API_BASE}/products/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  importProducts: (tenantId, products, supplierId = null) =>
    authFetch(`${API_BASE}/products/batch-import`, {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId, products, supplier_id: supplierId }),
    }).then((r) => r.json()),

  // Suppliers / Representantes
  getSuppliers: (tenantId) => authFetch(`${API_BASE}/suppliers?tenant_id=${tenantId}`).then((r) => r.json()),
  getSupplier: (id) => authFetch(`${API_BASE}/suppliers/${id}`).then((r) => r.json()),
  getManufacturers: (tenantId) => authFetch(`${API_BASE}/suppliers/manufacturers?tenant_id=${tenantId}`).then((r) => r.json()),
  getProductSuppliers: (productId) => authFetch(`${API_BASE}/suppliers/product/${productId}/suppliers`).then((r) => r.json()),
  bindSupplierManufacturers: (data) =>
    authFetch(`${API_BASE}/suppliers/bind-manufacturers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  quoteMultivendor: (productId, sentBy = 'Farmacêutico') =>
    authFetch(`${API_BASE}/suppliers/quote-multivendor/${productId}`, {
      method: 'POST',
      body: JSON.stringify({ sent_by: sentBy }),
    }).then((r) => r.json()),
  createSupplier: (data) =>
    authFetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateSupplier: (id, data) =>
    authFetch(`${API_BASE}/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteSupplier: (id) => authFetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  notifySupplierLowStock: (productId, sentBy = 'Farmacêutico') =>
    authFetch(`${API_BASE}/suppliers/notify-low-stock/${productId}`, {
      method: 'POST',
      body: JSON.stringify({ sent_by: sentBy }),
    }).then((r) => r.json()),
  testSupplierWhatsApp: (supplierId, sentBy = 'Farmacêutico') =>
    authFetch(`${API_BASE}/suppliers/${supplierId}/test-whatsapp`, {
      method: 'POST',
      body: JSON.stringify({ sent_by: sentBy }),
    }).then((r) => r.json()),

  // Orders
  getOrders: (tenantId, status = '') => {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (status) params.append('status', status);
    return authFetch(`${API_BASE}/orders?${params}`).then((r) => r.json());
  },
  getOrder: (id) => authFetch(`${API_BASE}/orders/${id}`).then((r) => r.json()),
  confirmPayment: (orderId, confirmedBy) =>
    authFetch(`${API_BASE}/orders/${orderId}/confirm-payment`, {
      method: 'POST',
      body: JSON.stringify({ confirmed_by: confirmedBy }),
    }).then((r) => r.json()),
  releaseDelivery: (orderId, driverId) =>
    authFetch(`${API_BASE}/orders/${orderId}/release-delivery`, {
      method: 'POST',
      body: JSON.stringify({ driver_id: driverId }),
    }).then((r) => r.json()),
  markDelivered: (orderId) =>
    authFetch(`${API_BASE}/orders/${orderId}/mark-delivered`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).then((r) => r.json()),
  cancelOrder: (orderId) =>
    authFetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).then((r) => r.json()),
  deleteOrder: (orderId, userName = 'Administrador') =>
    authFetch(`${API_BASE}/orders/${orderId}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_name: userName }),
    }).then((r) => r.json()),

  // Drivers
  getDrivers: (tenantId) => authFetch(`${API_BASE}/drivers?tenant_id=${tenantId}`).then((r) => r.json()),
  createDriver: (data) =>
    authFetch(`${API_BASE}/drivers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateDriver: (id, data) =>
    authFetch(`${API_BASE}/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteDriver: (id) => authFetch(`${API_BASE}/drivers/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  testDriverMessage: (id) =>
    authFetch(`${API_BASE}/drivers/${id}/test-message`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).then((r) => r.json()),

  // WhatsApp
  getWhatsAppStatus: (tenantId) => authFetch(`${API_BASE}/whatsapp/${tenantId}/status`).then((r) => r.json()),
  connectWhatsApp: (tenantId) =>
    authFetch(`${API_BASE}/whatsapp/${tenantId}/connect`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).then((r) => r.json()),
  disconnectWhatsApp: (tenantId) =>
    authFetch(`${API_BASE}/whatsapp/${tenantId}/disconnect`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).then((r) => r.json()),

  // Chat
  getConversations: (tenantId) => authFetch(`${API_BASE}/chat/${tenantId}/conversations`).then((r) => r.json()),
  getMessages: (tenantId, phone) => authFetch(`${API_BASE}/chat/${tenantId}/messages/${phone}`).then((r) => r.json()),
  sendChatMessage: (tenantId, customerPhone, text) =>
    authFetch(`${API_BASE}/chat/${tenantId}/send`, {
      method: 'POST',
      body: JSON.stringify({ customerPhone, text }),
    }).then((r) => r.json()),
  toggleHumanSupport: (tenantId, customerPhone, isHuman) =>
    authFetch(`${API_BASE}/chat/${tenantId}/toggle-human`, {
      method: 'POST',
      body: JSON.stringify({ customerPhone, isHuman }),
    }).then((r) => r.json()),
  deleteConversation: (tenantId, customerPhone) =>
    authFetch(`${API_BASE}/chat/${tenantId}/delete-conversation`, {
      method: 'POST',
      body: JSON.stringify({ customerPhone }),
    }).then((r) => r.json()),

  // Simulator
  simulateMessage: (tenantId, phone, name, text) =>
    authFetch(`${API_BASE}/simulation/message`, {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId, phone, name, text }),
    }).then((r) => r.json()),
  getSimulationHistory: (tenantId, phone) =>
    authFetch(`${API_BASE}/simulation/history/${tenantId}/${phone}`).then((r) => r.json()),
  resetSimulation: (tenantId, phone) =>
    authFetch(`${API_BASE}/simulation/reset`, {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId, phone }),
    }).then((r) => r.json()),

  // Users (Admin panel & Email/Password management)
  getUsers: (tenantId) => {
    const url = tenantId ? `${API_BASE}/auth/users?tenant_id=${tenantId}` : `${API_BASE}/auth/users`;
    return authFetch(url).then((r) => r.json());
  },
  createUser: (data) =>
    authFetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateUser: (id, data) =>
    authFetch(`${API_BASE}/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteUser: (id) =>
    authFetch(`${API_BASE}/auth/users/${id}`, {
      method: 'DELETE',
    }).then((r) => r.json()),

  // Marketing Campaigns & Broadcasts
  getCampaigns: (tenantId) => authFetch(`${API_BASE}/campaigns?tenant_id=${tenantId}`).then((r) => r.json()),
  getCampaignLeads: (tenantId) => authFetch(`${API_BASE}/campaigns/leads?tenant_id=${tenantId}`).then((r) => r.json()),
  addCampaignLead: (data) =>
    authFetch(`${API_BASE}/campaigns/leads`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  importCampaignLeads: (data) =>
    authFetch(`${API_BASE}/campaigns/leads/bulk`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteCampaignLead: (tenantId, phone) =>
    authFetch(`${API_BASE}/campaigns/leads/${phone}?tenant_id=${tenantId}`, {
      method: 'DELETE',
    }).then((r) => r.json()),
  createCampaign: (data) =>
    authFetch(`${API_BASE}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  testCampaignMessage: (data) =>
    authFetch(`${API_BASE}/campaigns/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  getCampaignDetails: (id) => authFetch(`${API_BASE}/campaigns/${id}`).then((r) => r.json()),
  pauseCampaign: (id) =>
    authFetch(`${API_BASE}/campaigns/${id}/pause`, { method: 'POST' }).then((r) => r.json()),
  resumeCampaign: (id) =>
    authFetch(`${API_BASE}/campaigns/${id}/resume`, { method: 'POST' }).then((r) => r.json()),
  cancelCampaign: (id) =>
    authFetch(`${API_BASE}/campaigns/${id}/cancel`, { method: 'POST' }).then((r) => r.json()),
};
