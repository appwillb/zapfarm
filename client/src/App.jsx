import React, { useState, useEffect } from 'react';
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
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardTab
              dashboardData={dashboardData}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenOrder={(order) => setOrderModal({ open: true, order })}
              onConfirmPayment={handleConfirmPayment}
              onReleaseDelivery={(id) => handleReleaseDelivery(id, null)}
            />
          )}

          {currentTab === 'orders' && (
            <OrdersTab
              orders={orders}
              drivers={drivers}
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
              onOpenAddProduct={() => setProductModal({ open: true, product: null })}
              onOpenEditProduct={(product) => setProductModal({ open: true, product })}
              onOpenImportCsv={() => setCsvModalOpen(true)}
              onDeleteProduct={handleDeleteProduct}
            />
          )}

          {currentTab === 'inventory' && <InventoryTab products={products} />}

          {currentTab === 'drivers' && (
            <DriversTab
              drivers={drivers}
              onOpenAddDriver={() => setDriverModal({ open: true, driver: null })}
              onOpenEditDriver={(driver) => setDriverModal({ open: true, driver })}
              onUpdateDriverStatus={handleUpdateDriverStatus}
              onTestDriverMessage={handleTestDriverMessage}
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
            />
          )}

          {currentTab === 'saas_admin' && (
            <SaasAdminTab tenants={tenants} onTenantCreated={loadTenants} />
          )}

          {currentTab === 'settings' && (
            <SettingsTab
              tenant={selectedTenant}
              onTenantUpdated={() => {
                loadTenants();
                loadTenantData();
              }}
            />
          )}
        </main>
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
