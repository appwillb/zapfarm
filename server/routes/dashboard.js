const express = require('express');
const router = express.Router();
const db = require('../db/database');
const sessionManager = require('../baileys/sessionManager');

// GET /api/dashboard/:tenantId
router.get('/:tenantId', (req, res) => {
  const tenantId = req.params.tenantId;

  // 1. Order counts by status
  const pendingOrders = db
    .prepare("SELECT COUNT(*) as count FROM orders WHERE tenant_id = ? AND status = 'pending_payment'")
    .get(tenantId).count;

  const preparingOrders = db
    .prepare("SELECT COUNT(*) as count FROM orders WHERE tenant_id = ? AND status = 'paid'")
    .get(tenantId).count;

  const inTransitOrders = db
    .prepare("SELECT COUNT(*) as count FROM orders WHERE tenant_id = ? AND status = 'in_transit'")
    .get(tenantId).count;

  const deliveredOrders = db
    .prepare("SELECT COUNT(*) as count FROM orders WHERE tenant_id = ? AND status = 'delivered'")
    .get(tenantId).count;

  // 2. Financial Metrics (Total Paid Revenue)
  const totalRevenue = db
    .prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE tenant_id = ? AND status IN ('paid', 'ready_for_delivery', 'in_transit', 'delivered')")
    .get(tenantId).total;

  const todayRevenue = db
    .prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM orders
      WHERE tenant_id = ? AND status IN ('paid', 'ready_for_delivery', 'in_transit', 'delivered')
      AND date(created_at) = date('now')
    `)
    .get(tenantId).total;

  // 3. Low stock alerts
  const lowStockProducts = db
    .prepare(`
      SELECT id, name, dosage, presentation, stock_quantity, min_stock, reserved_quantity
      FROM products
      WHERE tenant_id = ? AND active = 1 AND stock_quantity <= min_stock
      ORDER BY stock_quantity ASC
      LIMIT 10
    `)
    .all(tenantId);

  // 4. Active Delivery Drivers
  const availableDrivers = db
    .prepare("SELECT COUNT(*) as count FROM delivery_drivers WHERE tenant_id = ? AND status = 'available' AND active = 1")
    .get(tenantId).count;

  const onDeliveryDrivers = db
    .prepare("SELECT COUNT(*) as count FROM delivery_drivers WHERE tenant_id = ? AND status = 'on_delivery' AND active = 1")
    .get(tenantId).count;

  // 5. Recent Orders
  const recentOrders = db
    .prepare(`
      SELECT o.*, d.name as driver_name
      FROM orders o
      LEFT JOIN delivery_drivers d ON o.driver_id = d.id
      WHERE o.tenant_id = ?
      ORDER BY o.id DESC
      LIMIT 6
    `)
    .all(tenantId);

  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const enrichedRecent = recentOrders.map((o) => ({
    ...o,
    items: getItems.all(o.id),
  }));

  // 6. WhatsApp connection state
  const whatsappState = sessionManager.getSessionState(tenantId);

  res.json({
    metrics: {
      todayRevenue,
      totalRevenue,
      pendingOrders,
      preparingOrders,
      inTransitOrders,
      deliveredOrders,
      availableDrivers,
      onDeliveryDrivers,
      lowStockCount: lowStockProducts.length,
    },
    lowStockProducts,
    recentOrders: enrichedRecent,
    whatsapp: whatsappState,
  });
});

module.exports = router;
