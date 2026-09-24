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
import { api } from './api';

export default function App() {
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

  // 1. Initial Load: Tenants
  const loadTenants = async () => {
    try {
      const data = await api.getTenants();
      setTenants(data);
      if (!selectedTenant && data.length > 0) {
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
              onUpdateDriverStatus={handleUpdateDriverStatus}
              onTestDriverMessage={handleTestDriverMessage}
              onDeleteDriver={async (id) => {
                if (confirm('Deseja desativar este entregador?')) {
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

          {currentTab === 'chat' && <ChatTab tenantId={selectedTenant?.id || 1} />}

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
        onOrderCreated={loadTenantData}
      />
    </div>
  );
}
