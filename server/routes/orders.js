const express = require('express');
const router = express.Router();
const db = require('../db/database');
const botEngine = require('../bot/botEngine');

// GET /api/orders?tenant_id=1&status=pending_payment
router.get('/', (req, res) => {
  const tenantId = req.query.tenant_id || 1;
  const status = req.query.status;

  let query = `
    SELECT o.*, d.name as driver_name, d.phone as driver_phone, d.vehicle as driver_vehicle
    FROM orders o
    LEFT JOIN delivery_drivers d ON o.driver_id = d.id
    WHERE o.tenant_id = ?
  `;
  const params = [tenantId];

  if (status && status !== 'all') {
    query += ' AND o.status = ?';
    params.push(status);
  }

  query += ' ORDER BY o.id DESC';

  const orders = db.prepare(query).all(...params);

  // Attach items to each order
  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const enrichedOrders = orders.map((order) => {
    return {
      ...order,
      items: getItems.all(order.id),
    };
  });

  res.json(enrichedOrders);
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const order = db
    .prepare(
      `
    SELECT o.*, d.name as driver_name, d.phone as driver_phone, d.vehicle as driver_vehicle, d.plate as driver_plate
    FROM orders o
    LEFT JOIN delivery_drivers d ON o.driver_id = d.id
    WHERE o.id = ?
  `
    )
    .get(req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

// POST /api/orders/:id/confirm-payment
// STRICT RULE: Confirm payment with pharmacist/staff verification
router.post('/:id/confirm-payment', async (req, res) => {
  const orderId = req.params.id;
  const confirmedBy = req.body.confirmed_by || 'Farmacêutico (Painel)';

  try {
    const updatedOrder = await botEngine.confirmOrderPayment(orderId, confirmedBy);
    res.json({
      success: true,
      message: 'Pagamento Pix confirmado com sucesso e estoque atualizado!',
      order: updatedOrder,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao confirmar pagamento: ' + err.message });
  }
});

// POST /api/orders/:id/release-delivery
// Triggers automatic WhatsApp message to Driver and Customer
router.post('/:id/release-delivery', async (req, res) => {
  const orderId = req.params.id;
  const driverId = req.body.driver_id ? Number(req.body.driver_id) : null;

  try {
    const result = await botEngine.releaseOrderForDelivery(orderId, driverId);
    res.json({
      success: true,
      message: 'Pedido liberado! Entregador e cliente notificados via WhatsApp.',
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao liberar pedido: ' + err.message });
  }
});

// POST /api/orders/:id/mark-delivered
router.post('/:id/mark-delivered', async (req, res) => {
  const orderId = req.params.id;
  try {
    const updatedOrder = await botEngine.markOrderDelivered(orderId);
    res.json({
      success: true,
      message: 'Entrega finalizada com sucesso! Cliente notificado.',
      order: updatedOrder,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao finalizar entrega: ' + err.message });
  }
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  const orderId = req.params.id;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

  try {
    // If pending payment, release reserved stock; if paid/in-transit (e.g. card on delivery), restore physical stock
    if (order.status === 'pending_payment') {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      const restoreStock = db.prepare('UPDATE products SET reserved_quantity = MAX(0, reserved_quantity - ?) WHERE id = ?');
      for (const item of items) {
        restoreStock.run(item.quantity, item.product_id);
      }
    } else if (order.status === 'paid' || order.status === 'ready_for_delivery' || order.status === 'in_transit') {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      const restoreStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?');
      for (const item of items) {
        restoreStock.run(item.quantity, item.product_id);
      }
    }

    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);

    // Free driver if assigned
    if (order.driver_id) {
      db.prepare("UPDATE delivery_drivers SET status = 'available' WHERE id = ?").run(order.driver_id);
    }

    // Notify customer
    await botEngine.sendReply(
      order.tenant_id,
      order.customer_phone,
      `⚠️ *PEDIDO #${orderId} CANCELADO*\nSeu pedido foi cancelado no sistema da farmácia. Para qualquer esclarecimento, estamos à disposição!`
    );

    res.json({ success: true, message: 'Pedido cancelado.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cancelar pedido: ' + err.message });
  }
});

module.exports = router;
