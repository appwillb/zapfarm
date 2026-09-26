import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, MessageSquare, Megaphone, Pill, Menu as MenuIcon } from 'lucide-react';
import { canUser } from './utils/permissions';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardTab from './components/DashboardTab';
import OrdersTab from './components/OrdersTab';
import ProductsTab from './components/ProductsTab';
import InventoryTab from './components/InventoryTab';
import DriversTab from './components/DriversTab';
import WhatsAppTab from './components/WhatsAppTab';
import ChatTab from './components/ChatTab';
import SaasAdminTab from './components/SaasAdminTab';
import SettingsTab from './components/SettingsTab';
import CampaignsTab from './components/CampaignsTab';
import ProductModal from './components/ProductModal';
import DriverModal from './components/DriverModal';
import CsvImportModal from './components/CsvImportModal';
import OrderDetailsModal from './components/OrderDetailsModal';
import SimulatorModal from './components/SimulatorModal';
import LoginScreen from './components/LoginScreen';
import IncomingCallToast from './components/IncomingCallToast';
import { api } from './api';
import { wsClient } from './services/websocket';
import { playIncomingMessageAlert, unlockAudio } from './services/soundAlerts';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('zapfarm_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [whatsappStatus, setWhatsappStatus] = useState({ status: 'disconnected', qrCode: null });

  // Modals
  const [productModal, setProductModal] = useState({ open: false, product: null });
  const [driverModal, setDriverModal] = useState({ open: false, driver: null });
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [orderModal, setOrderModal] = useState({ open: false, order: null });
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);
  const [selectedChatPhone, setSelectedChatPhone] = useState(null);

  // 3. Real-Time WebSocket Connection & Balcão Audio/Voice Notifications
  useEffect(() => {
    if (!selectedTenant?.id) return;

    wsClient.connect(selectedTenant.id);

    const unsubChat = wsClient.subscribe('new_chat_message', (payload) => {
      if (!payload.fromMe) {
        unlockAudio();
        // Play voice & chime
        playIncomingMessageAlert({
          customerName: payload.pushName,
          customerPhone: payload.customerPhone,
          text: payload.text,
          isHumanRequest: false,
        });

        // Trigger floating banner
        setActiveAlert({
          id: Date.now(),
          customerName: payload.pushName,
          customerPhone: payload.customerPhone,
          text: payload.text,
          type: 'incoming_chat',
        });
      }
    });

    const unsubHuman = wsClient.subscribe('human_support_requested', (payload) => {
      unlockAudio();
      playIncomingMessageAlert({
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        text: payload.text,
        isHumanRequest: true,
        force: true,
      });

      setActiveAlert({
        id: Date.now(),
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        text: payload.text || 'Solicitou atendimento humano',
        type: 'human_support',
      });
    });

    const unsubOrder = wsClient.subscribe('new_order_placed', (payload) => {
      unlockAudio();
      playIncomingMessageAlert({
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        text: `Pedido #${payload.orderId}`,
        isNewOrder: true,
        force: true,
      });
      loadTenantData();
    });

    const unsubWs = wsClient.subscribe('whatsapp_status', (payload) => {
      setWhatsappStatus(payload);
    });

    return () => {
      unsubChat();
      unsubHuman();
      unsubOrder();
      unsubWs();
      wsClient.disconnect();
    };
  }, [selectedTenant?.id]);

  // Handle Authentication
  const handleLoginSuccess = (data) => {
    localStorage.setItem('zapfarm_token', data.token);
    localStorage.setItem('zapfarm_user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    if (data.tenant) {
      setSelectedTenant(data.tenant);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zapfarm_token');
    localStorage.removeItem('zapfarm_user');
    setCurrentUser(null);
    setCurrentTab('dashboard');
  };

  const handleUpdateCurrentUser = (updatedUser) => {
    setCurrentUser((prev) => {
      const merged = { ...prev, ...updatedUser };
      localStorage.setItem('zapfarm_user', JSON.stringify(merged));
      return merged;
    });
  };

  // 1. Initial Load: Tenants
  const loadTenants = async () => {
    try {
      const data = await api.getTenants();
      setTenants(data);
      if (currentUser?.tenant_id) {
        const myTenant = data.find((t) => t.id === currentUser.tenant_id);
        if (myTenant) setSelectedTenant(myTenant);
      } else if (!selectedTenant && data.length > 0) {
        setSelectedTenant(data[0]);
      }
    } catch (e) {
      console.error('Error loading tenants:', e);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  // 2. Load Tenant Data whenever selectedTenant changes
  const loadTenantData = async () => {
    if (!selectedTenant) return;
    const tid = selectedTenant.id;

    try {
      const [dash, ords, prods, drivs, ws] = await Promise.all([
        api.getDashboard(tid),
        api.getOrders(tid),
        api.getProducts(tid),
        api.getDrivers(tid),
        api.getWhatsAppStatus(tid),
      ]);

      setDashboardData(dash);
      setOrders(ords);
      setProducts(prods);
      setDrivers(drivs);
      setWhatsappStatus(ws);
    } catch (e) {
      console.error('Error loading tenant data:', e);
    }
  };

  useEffect(() => {
    if (selectedTenant) {
      loadTenantData();
      const interval = setInterval(loadTenantData, 4000);
      return () => clearInterval(interval);
    }
  }, [selectedTenant]);

  // Actions
  const handleConfirmPayment = async (orderId) => {
    try {
      const res = await api.confirmPayment(orderId, 'Dra. Camila (Farmacêutica)');
      alert(res.message);
      await loadTenantData();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleReleaseDelivery = async (orderId, driverId) => {
    try {
      const res = await api.releaseDelivery(orderId, driverId);
      alert(res.message);
      await loadTenantData();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleMarkDelivered = async (orderId) => {
    try {
      const res = await api.markDelivered(orderId);
      alert(res.message);
      await loadTenantData();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm('Deseja realmente cancelar este pedido? O estoque reservado será liberado.')) return;
    try {
      const res = await api.cancelOrder(orderId);
      alert(res.message);
      await loadTenantData();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Deseja desativar este medicamento do catálogo?')) return;
    try {
      await api.deleteProduct(id);
      await loadTenantData();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleUpdateDriverStatus = async (id, status) => {
    try {
      await api.updateDriver(id, { status });
      await loadTenantData();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleTestDriverMessage = async (id) => {
    try {
      const res = await api.testDriverMessage(id);
      alert(res.message);
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!selectedTenant) return;
    try {
      const res = await api.connectWhatsApp(selectedTenant.id);
      setWhatsappStatus(res);
    } catch (err) {
      alert('Erro ao conectar WhatsApp: ' + err.message);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!selectedTenant) return;
    if (!confirm('Deseja desconectar a sessão do WhatsApp desta farmácia?')) return;
    try {
      await api.disconnectWhatsApp(selectedTenant.id);
      setWhatsappStatus({ status: 'disconnected', qrCode: null });
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  // If user is not logged in, show Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        tenants={tenants}
        selectedTenant={selectedTenant}
        setSelectedTenant={setSelectedTenant}
        whatsappStatus={whatsappStatus}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenSimulator={() => setSimulatorOpen(true)}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Header
          setMobileOpen={setMobileOpen}
          currentTab={currentTab}
          tenant={selectedTenant}
          whatsappStatus={whatsappStatus}
          onOpenWhatsApp={() => setCurrentTab('whatsapp')}
          onOpenSimulator={() => setSimulatorOpen(true)}
          onOpenChat={() => setCurrentTab('chat')}
          currentUser={currentUser}
          onUpdateCurrentUser={handleUpdateCurrentUser}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {currentTab === 'dashboard' && (
            <DashboardTab
              dashboardData={dashboardData}
              currentUser={currentUser}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenOrder={(order) => setOrderModal({ open: true, order })}
              onConfirmPayment={handleConfirmPayment}
              onReleaseDelivery={(id) => handleReleaseDelivery(id, null)}
              onRefresh={loadTenantData}
            />
          )}

          {currentTab === 'orders' && (
            <OrdersTab
              orders={orders}
              drivers={drivers}
              currentUser={currentUser}
              onConfirmPayment={handleConfirmPayment}
              onReleaseDelivery={handleReleaseDelivery}
              onMarkDelivered={handleMarkDelivered}
              onCancelOrder={handleCancelOrder}
              onOpenOrder={(order) => setOrderModal({ open: true, order })}
              onRefresh={loadTenantData}
            />
          )}

          {currentTab === 'products' && (
            <ProductsTab
              products={products}
              currentUser={currentUser}
              onOpenAddProduct={() => setProductModal({ open: true, product: null })}
              onOpenEditProduct={(product) => setProductModal({ open: true, product })}
              onOpenImportCsv={() => setCsvModalOpen(true)}
              onDeleteProduct={handleDeleteProduct}
              onRefresh={loadTenantData}
            />
          )}

          {currentTab === 'inventory' && <InventoryTab products={products} />}

          {currentTab === 'drivers' && (
            <DriversTab
              drivers={drivers}
              currentUser={currentUser}
              onOpenAddDriver={() => setDriverModal({ open: true, driver: null })}
              onOpenEditDriver={(driver) => setDriverModal({ open: true, driver })}
              onUpdateDriverStatus={handleUpdateDriverStatus}
              onTestDriverMessage={handleTestDriverMessage}
              onRefresh={loadTenantData}
              onDeleteDriver={async (id) => {
                if (confirm('Deseja realmente excluir este entregador?')) {
                  await api.deleteDriver(id);
                  await loadTenantData();
                }
              }}
            />
          )}

          {currentTab === 'whatsapp' && (
            <WhatsAppTab
              whatsappStatus={whatsappStatus}
              onConnect={handleConnectWhatsApp}
              onDisconnect={handleDisconnectWhatsApp}
              onRefresh={loadTenantData}
            />
          )}

          {currentTab === 'chat' && (
            <ChatTab
              tenantId={selectedTenant?.id || 1}
              initialPhone={selectedChatPhone}
              onPhoneSelected={setSelectedChatPhone}
              whatsappStatus={whatsappStatus}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'campaigns' && (
            <CampaignsTab
              tenant={selectedTenant}
              whatsappStatus={whatsappStatus}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'saas_admin' && (
            <SaasAdminTab tenants={tenants} onTenantCreated={loadTenants} />
          )}

          {currentTab === 'settings' && (
            <SettingsTab
              tenant={selectedTenant}
              currentUser={currentUser}
              onUpdateCurrentUser={handleUpdateCurrentUser}
              onTenantUpdated={() => {
                loadTenants();
                loadTenantData();
              }}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-around px-2 shadow-lg">
          <button
            type="button"
            onClick={() => setCurrentTab('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              currentTab === 'dashboard' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard size={20} className={currentTab === 'dashboard' ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] mt-0.5 font-medium">Início</span>
          </button>

          {canUser(currentUser, 'orders_view') && (
            <button
              type="button"
              onClick={() => setCurrentTab('orders')}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                currentTab === 'orders' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShoppingBag size={20} className={currentTab === 'orders' ? 'scale-110 transition-transform' : ''} />
              <span className="text-[10px] mt-0.5 font-medium">Pedidos</span>
              {orders.filter((o) => o.status === 'pending_payment' || o.status === 'paid').length > 0 && (
                <span className="absolute top-1 right-3 sm:right-6 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          )}

          {canUser(currentUser, 'chat_access') ? (
            <button
              type="button"
              onClick={() => setCurrentTab('chat')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                currentTab === 'chat' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <MessageSquare size={20} className={currentTab === 'chat' ? 'scale-110 transition-transform' : ''} />
              <span className="text-[10px] mt-0.5 font-medium">Chat</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentTab('products')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                currentTab === 'products' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Pill size={20} className={currentTab === 'products' ? 'scale-110 transition-transform' : ''} />
              <span className="text-[10px] mt-0.5 font-medium">Remédios</span>
            </button>
          )}

          {canUser(currentUser, 'campaigns_access') && (
            <button
              type="button"
              onClick={() => setCurrentTab('campaigns')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                currentTab === 'campaigns' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Megaphone size={20} className={currentTab === 'campaigns' ? 'scale-110 transition-transform' : ''} />
              <span className="text-[10px] mt-0.5 font-medium">Ofertas</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <MenuIcon size={20} />
            <span className="text-[10px] mt-0.5 font-medium">Mais</span>
          </button>
        </nav>
      </div>

      {/* Global Modals */}
      <ProductModal
        isOpen={productModal.open}
        onClose={() => setProductModal({ open: false, product: null })}
        product={productModal.product}
        tenantId={selectedTenant?.id || 1}
        onSaved={loadTenantData}
      />

      <DriverModal
        isOpen={driverModal.open}
        onClose={() => setDriverModal({ open: false, driver: null })}
        driver={driverModal.driver}
        tenantId={selectedTenant?.id || 1}
        onSaved={loadTenantData}
      />

      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        tenantId={selectedTenant?.id || 1}
        onImported={loadTenantData}
      />

      <OrderDetailsModal
        isOpen={orderModal.open}
        onClose={() => setOrderModal({ open: false, order: null })}
        order={orderModal.order}
        currentUser={currentUser}
        onConfirmPayment={handleConfirmPayment}
        onReleaseDelivery={handleReleaseDelivery}
        onMarkDelivered={handleMarkDelivered}
      />

      <SimulatorModal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        tenantId={selectedTenant?.id || 1}
        tenantName={selectedTenant?.name}
        tenantLogo={selectedTenant?.logo_url}
        onOrderCreated={loadTenantData}
      />

      {/* Floating Real-Time Balcão WhatsApp Audio Alert & Toast */}
      <IncomingCallToast
        alert={activeAlert}
        onOpenChat={(phone) => {
          setActiveAlert(null);
          setSelectedChatPhone(phone);
          setCurrentTab('chat');
        }}
        onDismiss={() => setActiveAlert(null)}
      />
    </div>
  );
}
