const API_BASE = '/api';

export const api = {
  // Tenants
  getTenants: () => fetch(`${API_BASE}/tenants`).then((r) => r.json()),
  getTenant: (id) => fetch(`${API_BASE}/tenants/${id}`).then((r) => r.json()),
  updateTenant: (id, data) =>
    fetch(`${API_BASE}/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  createTenant: (data) =>
    fetch(`${API_BASE}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  previewPix: (id, data) =>
    fetch(`${API_BASE}/tenants/${id}/preview-pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // Dashboard
  getDashboard: (tenantId) => fetch(`${API_BASE}/dashboard/${tenantId}`).then((r) => r.json()),

  // Products
  getProducts: (tenantId, search = '', category = '', supplierId = '') => {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (supplierId) params.append('supplier_id', supplierId);
    return fetch(`${API_BASE}/products?${params}`).then((r) => r.json());
  },
  createProduct: (data) =>
    fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateProduct: (id, data) =>
    fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteProduct: (id) => fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  importProducts: (tenantId, products, supplierId = null) =>
    fetch(`${API_BASE}/products/batch-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, products, supplier_id: supplierId }),
    }).then((r) => r.json()),

  // Suppliers / Representantes
  getSuppliers: (tenantId) => fetch(`${API_BASE}/suppliers?tenant_id=${tenantId}`).then((r) => r.json()),
  getSupplier: (id) => fetch(`${API_BASE}/suppliers/${id}`).then((r) => r.json()),
  createSupplier: (data) =>
    fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateSupplier: (id, data) =>
    fetch(`${API_BASE}/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteSupplier: (id) => fetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  notifySupplierLowStock: (productId, sentBy = 'Farmacêutico') =>
    fetch(`${API_BASE}/suppliers/notify-low-stock/${productId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sent_by: sentBy }),
    }).then((r) => r.json()),
  testSupplierWhatsApp: (supplierId, sentBy = 'Farmacêutico') =>
    fetch(`${API_BASE}/suppliers/${supplierId}/test-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sent_by: sentBy }),
    }).then((r) => r.json()),

  // Orders
  getOrders: (tenantId, status = '') => {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (status) params.append('status', status);
    return fetch(`${API_BASE}/orders?${params}`).then((r) => r.json());
  },
  confirmPayment: (orderId, confirmedBy) =>
    fetch(`${API_BASE}/orders/${orderId}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed_by: confirmedBy }),
    }).then((r) => r.json()),
  releaseDelivery: (orderId, driverId) =>
    fetch(`${API_BASE}/orders/${orderId}/release-delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driverId }),
    }).then((r) => r.json()),
  markDelivered: (orderId) =>
    fetch(`${API_BASE}/orders/${orderId}/mark-delivered`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => r.json()),
  cancelOrder: (orderId) =>
    fetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => r.json()),

  // Drivers
  getDrivers: (tenantId) => fetch(`${API_BASE}/drivers?tenant_id=${tenantId}`).then((r) => r.json()),
  createDriver: (data) =>
    fetch(`${API_BASE}/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateDriver: (id, data) =>
    fetch(`${API_BASE}/drivers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteDriver: (id) => fetch(`${API_BASE}/drivers/${id}`, { method: 'DELETE' }).then((r) => r.json()),
  testDriverMessage: (id) =>
    fetch(`${API_BASE}/drivers/${id}/test-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => r.json()),

  // WhatsApp
  getWhatsAppStatus: (tenantId) => fetch(`${API_BASE}/whatsapp/${tenantId}/status`).then((r) => r.json()),
  connectWhatsApp: (tenantId) =>
    fetch(`${API_BASE}/whatsapp/${tenantId}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => r.json()),
  disconnectWhatsApp: (tenantId) =>
    fetch(`${API_BASE}/whatsapp/${tenantId}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => r.json()),

  // Chat
  getConversations: (tenantId) => fetch(`${API_BASE}/chat/${tenantId}/conversations`).then((r) => r.json()),
  getMessages: (tenantId, phone) => fetch(`${API_BASE}/chat/${tenantId}/messages/${phone}`).then((r) => r.json()),
  sendChatMessage: (tenantId, customerPhone, text) =>
    fetch(`${API_BASE}/chat/${tenantId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerPhone, text }),
    }).then((r) => r.json()),
  toggleHumanSupport: (tenantId, customerPhone, isHuman) =>
    fetch(`${API_BASE}/chat/${tenantId}/toggle-human`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerPhone, isHuman }),
    }).then((r) => r.json()),
  deleteConversation: (tenantId, customerPhone) =>
    fetch(`${API_BASE}/chat/${tenantId}/delete-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerPhone }),
    }).then((r) => r.json()),

  // Simulator
  simulateMessage: (tenantId, phone, name, text) =>
    fetch(`${API_BASE}/simulation/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, phone, name, text }),
    }).then((r) => r.json()),
  getSimulationHistory: (tenantId, phone) =>
    fetch(`${API_BASE}/simulation/history/${tenantId}/${phone}`).then((r) => r.json()),
  resetSimulation: (tenantId, phone) =>
    fetch(`${API_BASE}/simulation/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, phone }),
    }).then((r) => r.json()),

  // Users (Admin panel & Email/Password management)
  getUsers: (tenantId) => {
    const url = tenantId ? `${API_BASE}/auth/users?tenant_id=${tenantId}` : `${API_BASE}/auth/users`;
    return fetch(url).then((r) => r.json());
  },
  createUser: (data) =>
    fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateUser: (id, data) =>
    fetch(`${API_BASE}/auth/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteUser: (id) =>
    fetch(`${API_BASE}/auth/users/${id}`, {
      method: 'DELETE',
    }).then((r) => r.json()),

  // Marketing Campaigns & Broadcasts
  getCampaigns: (tenantId) => fetch(`${API_BASE}/campaigns?tenant_id=${tenantId}`).then((r) => r.json()),
  getCampaignLeads: (tenantId) => fetch(`${API_BASE}/campaigns/leads?tenant_id=${tenantId}`).then((r) => r.json()),
  addCampaignLead: (data) =>
    fetch(`${API_BASE}/campaigns/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  importCampaignLeads: (data) =>
    fetch(`${API_BASE}/campaigns/leads/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteCampaignLead: (tenantId, phone) =>
    fetch(`${API_BASE}/campaigns/leads/${phone}?tenant_id=${tenantId}`, {
      method: 'DELETE',
    }).then((r) => r.json()),
  createCampaign: (data) =>
    fetch(`${API_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  testCampaignMessage: (data) =>
    fetch(`${API_BASE}/campaigns/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  getCampaignDetails: (id) => fetch(`${API_BASE}/campaigns/${id}`).then((r) => r.json()),
  pauseCampaign: (id) =>
    fetch(`${API_BASE}/campaigns/${id}/pause`, { method: 'POST' }).then((r) => r.json()),
  resumeCampaign: (id) =>
    fetch(`${API_BASE}/campaigns/${id}/resume`, { method: 'POST' }).then((r) => r.json()),
  cancelCampaign: (id) =>
    fetch(`${API_BASE}/campaigns/${id}/cancel`, { method: 'POST' }).then((r) => r.json()),
};
