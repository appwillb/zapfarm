const express = require('express');
const router = express.Router();
const db = require('../db/database');
const botEngine = require('../bot/botEngine');

// GET /api/products?tenant_id=1&search=dipirona&category=...&supplier_id=...
router.get('/', (req, res) => {
  const tenantId = req.query.tenant_id || 1;
  const search = req.query.search ? `%${req.query.search}%` : null;
  const category = req.query.category || null;
  const supplierId = req.query.supplier_id || null;

  let query = `
    SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.company as supplier_company
    FROM products p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.tenant_id = ? AND p.active = 1
  `;
  const params = [tenantId];

  if (supplierId && supplierId !== 'all') {
    query += ' AND p.supplier_id = ?';
    params.push(Number(supplierId));
  }

  if (search) {
    query += ' AND (p.name LIKE ? OR p.active_ingredient LIKE ? OR p.barcode LIKE ? OR s.name LIKE ?)';
    params.push(search, search, search, search);
  }

  if (category && category !== 'Todos') {
    query += ' AND p.category = ?';
    params.push(category);
  }

  query += ' ORDER BY p.name ASC';

  const products = db.prepare(query).all(...params);
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.company as supplier_company
    FROM products p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }
  const batches = db.prepare('SELECT * FROM batches WHERE product_id = ? ORDER BY expiry_date ASC').all(req.params.id);
  res.json({ ...product, batches });
});

// POST /api/products
router.post('/', (req, res) => {
  const {
    tenant_id = 1,
    name,
    active_ingredient,
    manufacturer,
    dosage,
    form,
    presentation,
    barcode,
    cost_price = 0,
    sale_price,
    stock_quantity = 0,
    min_stock = 5,
    requires_prescription = 0,
    prescription_type = 'livre',
    category = 'Medicamentos',
    supplier_id = null,
  } = req.body;

  if (!name || sale_price === undefined) {
    return res.status(400).json({ error: 'Nome do produto e preço de venda são obrigatórios.' });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO products (
        tenant_id, name, active_ingredient, manufacturer, dosage, form, presentation, barcode,
        cost_price, sale_price, stock_quantity, min_stock, reserved_quantity, requires_prescription,
        prescription_type, category, supplier_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);

    const result = insert.run(
      tenant_id,
      name,
      active_ingredient || '',
      manufacturer || '',
      dosage || '',
      form || '',
      presentation || '',
      barcode || '',
      Number(cost_price) || 0,
      Number(sale_price),
      Number(stock_quantity) || 0,
      Number(min_stock) || 5,
      requires_prescription ? 1 : 0,
      prescription_type || 'livre',
      category || 'Medicamentos',
      supplier_id ? Number(supplier_id) : null
    );

    const newProd = db.prepare(`
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.company as supplier_company
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    // If initial stock is already <= min_stock, notify supplier
    if (newProd.stock_quantity <= newProd.min_stock && newProd.supplier_id) {
      botEngine.checkAndNotifyLowStock(tenant_id, [newProd.id]).catch((e) => console.error(e));
    }

    res.status(201).json(newProd);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar medicamento: ' + err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const {
    name,
    active_ingredient,
    manufacturer,
    dosage,
    form,
    presentation,
    barcode,
    cost_price,
    sale_price,
    stock_quantity,
    min_stock,
    requires_prescription,
    prescription_type,
    category,
    active,
    supplier_id,
  } = req.body;

  try {
    db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        active_ingredient = COALESCE(?, active_ingredient),
        manufacturer = COALESCE(?, manufacturer),
        dosage = COALESCE(?, dosage),
        form = COALESCE(?, form),
        presentation = COALESCE(?, presentation),
        barcode = COALESCE(?, barcode),
        cost_price = COALESCE(?, cost_price),
        sale_price = COALESCE(?, sale_price),
        stock_quantity = COALESCE(?, stock_quantity),
        min_stock = COALESCE(?, min_stock),
        requires_prescription = COALESCE(?, requires_prescription),
        prescription_type = COALESCE(?, prescription_type),
        category = COALESCE(?, category),
        active = COALESCE(?, active),
        supplier_id = CASE WHEN ? IS NOT NULL THEN ? ELSE supplier_id END
      WHERE id = ?
    `).run(
      name,
      active_ingredient,
      manufacturer,
      dosage,
      form,
      presentation,
      barcode,
      cost_price !== undefined ? Number(cost_price) : null,
      sale_price !== undefined ? Number(sale_price) : null,
      stock_quantity !== undefined ? Number(stock_quantity) : null,
      min_stock !== undefined ? Number(min_stock) : null,
      requires_prescription !== undefined ? (requires_prescription ? 1 : 0) : null,
      prescription_type,
      category,
      active !== undefined ? (active ? 1 : 0) : null,
      supplier_id !== undefined ? (supplier_id ? Number(supplier_id) : null) : null,
      supplier_id !== undefined ? (supplier_id ? Number(supplier_id) : null) : null,
      id
    );

    const updated = db.prepare(`
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.company as supplier_company
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(id);

    // If stock lowered to or below min_stock, notify supplier
    if (stock_quantity !== undefined && updated.stock_quantity <= updated.min_stock && updated.supplier_id) {
      botEngine.checkAndNotifyLowStock(updated.tenant_id, [id]).catch((e) => console.error(e));
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar medicamento: ' + err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Medicamento desativado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desativar medicamento.' });
  }
});

// POST /api/products/batch-import - Import array of items (from CSV parsing) with supplier support
router.post('/batch-import', (req, res) => {
  const { tenant_id = 1, products, supplier_id = null } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Nenhum produto enviado para importação.' });
  }

  const defaultSupplierId = supplier_id ? Number(supplier_id) : null;

  const insert = db.prepare(`
    INSERT INTO products (
      tenant_id, name, active_ingredient, manufacturer, dosage, form, presentation, barcode,
      cost_price, sale_price, stock_quantity, min_stock, reserved_quantity, requires_prescription,
      prescription_type, category, supplier_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    let count = 0;
    for (const item of items) {
      if (!item.name || !item.sale_price) continue;
      const itemSupplierId = item.supplier_id ? Number(item.supplier_id) : defaultSupplierId;

      insert.run(
        tenant_id,
        item.name,
        item.active_ingredient || '',
        item.manufacturer || '',
        item.dosage || '',
        item.form || 'Comprimido',
        item.presentation || '',
        item.barcode || '',
        Number(item.cost_price) || 0,
        Number(item.sale_price) || 0,
        Number(item.stock_quantity) || 10,
        Number(item.min_stock) || 5,
        item.requires_prescription ? 1 : 0,
        item.prescription_type || 'livre',
        item.category || 'Medicamentos',
        itemSupplierId
      );
      count++;
    }
    return count;
  });

  try {
    const importedCount = insertMany(products);
    res.json({ success: true, imported: importedCount });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar importação: ' + err.message });
  }
});

module.exports = router;

