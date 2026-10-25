const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db/database');
const botEngine = require('../bot/botEngine');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { parsePdfCatalog } = require('../utils/pdfCatalogParser');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // Até 15MB para catálogos em PDF
});

// GET /api/products?tenant_id=1&search=dipirona&category=...&supplier_id=...
router.get('/', authenticateToken, (req, res) => {
  const tenantId = req.query.tenant_id || 1;
  const search = req.query.search ? `%${req.query.search}%` : null;
  const category = req.query.category || null;
  const supplierId = req.query.supplier_id || null;

  let query = `
    SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.company as supplier_company,
           (SELECT COUNT(*) FROM product_suppliers ps WHERE ps.product_id = p.id) as suppliers_count
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
router.get('/:id', authenticateToken, (req, res) => {
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
router.post('/', authenticateToken, requireAdmin, (req, res) => {
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

    // Sync product_suppliers table
    if (newProd && newProd.supplier_id) {
      try {
        db.prepare(`
          INSERT INTO product_suppliers (tenant_id, product_id, supplier_id, is_primary)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(product_id, supplier_id) DO UPDATE SET is_primary = 1
        `).run(tenant_id, newProd.id, newProd.supplier_id);
      } catch (e) {}
    }

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
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
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

    // Sync product_suppliers table
    if (supplier_id !== undefined) {
      try {
        if (supplier_id) {
          db.prepare('UPDATE product_suppliers SET is_primary = 0 WHERE product_id = ?').run(id);
          db.prepare(`
            INSERT INTO product_suppliers (tenant_id, product_id, supplier_id, is_primary)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(product_id, supplier_id) DO UPDATE SET is_primary = 1
          `).run(updated.tenant_id, id, Number(supplier_id));
        } else {
          // If supplier was unset, demote primary
          db.prepare('UPDATE product_suppliers SET is_primary = 0 WHERE product_id = ?').run(id);
        }
      } catch (e) {}
    }

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
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Medicamento desativado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desativar medicamento.' });
  }
});

// POST /api/products/parse-pdf - Analisa arquivo PDF e extrai itens de catálogo sem salvar
router.post('/parse-pdf', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Nenhum arquivo PDF foi enviado.' });
    }

    const forceType = req.body.force_type || null;
    const parsed = await parsePdfCatalog(req.file.buffer, forceType);
    res.json({
      success: true,
      filename: req.file.originalname,
      fileType: parsed.fileType,
      totalExtracted: parsed.totalExtracted,
      items: parsed.items,
      rawTextPreview: parsed.rawTextPreview
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar catálogo em PDF: ' + err.message });
  }
});

// POST /api/products/batch-import - Import array of items (from CSV or PDF parsing) with sync/update mode support
router.post('/batch-import', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { tenant_id = 1, products, supplier_id = null, update_existing = true, file_type = 'generic' } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto enviado para importação.' });
    }

    const defaultSupplierId = supplier_id ? Number(supplier_id) : null;
    const isPromoBatch = file_type === 'promotions' || products.some(p => p.is_promotion === 1 && p.original_price > p.sale_price);

    const checkByBarcode = db.prepare('SELECT id, name, sale_price, original_price, stock_quantity, supplier_id FROM products WHERE tenant_id = ? AND barcode = ? AND barcode != \'\' LIMIT 1');
    const checkByName = db.prepare('SELECT id, name, sale_price, original_price, stock_quantity, supplier_id FROM products WHERE tenant_id = ? AND UPPER(TRIM(name)) = UPPER(TRIM(?)) LIMIT 1');

    // Atualização para Estoque Geral e Preços Normais (Parâmetros nomeados para imunidade total a falhas de contagem)
    const updateStockProd = db.prepare(`
      UPDATE products 
      SET sale_price = CASE WHEN @sale_price > 0 THEN @sale_price ELSE sale_price END,
          original_price = CASE 
            WHEN is_promotion = 1 THEN original_price
            WHEN @original_price > 0 THEN @original_price
            WHEN @sale_price > 0 THEN @sale_price
            ELSE original_price
          END,
          cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END,
          stock_quantity = CASE WHEN @stock_quantity >= 0 THEN @stock_quantity ELSE stock_quantity END,
          manufacturer = CASE WHEN @manufacturer != '' THEN @manufacturer ELSE manufacturer END,
          supplier_id = COALESCE(@supplier_id, supplier_id),
          active = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    // Atualização para Ofertas / Promoções (Preço De / Preço Por)
    const updatePromoProd = db.prepare(`
      UPDATE products 
      SET original_price = @original_price,
          sale_price = @sale_price,
          is_promotion = 1,
          active = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    const insertProd = db.prepare(`
      INSERT INTO products (
        tenant_id, name, active_ingredient, manufacturer, dosage, form, presentation, barcode,
        cost_price, sale_price, original_price, is_promotion, stock_quantity, min_stock, reserved_quantity, requires_prescription,
        prescription_type, category, supplier_id
      ) VALUES (
        @tenant_id, @name, @active_ingredient, @manufacturer, @dosage, @form, @presentation, @barcode,
        @cost_price, @sale_price, @original_price, @is_promotion, @stock_quantity, @min_stock, 0, @requires_prescription,
        @prescription_type, @category, @supplier_id
      )
    `);

    const upsertProductSupplier = db.prepare(`
      INSERT INTO product_suppliers (tenant_id, product_id, supplier_id, is_primary)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(product_id, supplier_id) DO UPDATE SET is_primary = 1
    `);

    const processMany = db.transaction((items) => {
      let createdCount = 0;
      let updatedCount = 0;
      let promosUpdatedCount = 0;

      for (const item of items) {
        if (!item.name || !item.sale_price) continue;
        const itemSupplierId = item.supplier_id ? Number(item.supplier_id) : defaultSupplierId;

        let existing = null;
        if (item.barcode && String(item.barcode).trim()) {
          existing = checkByBarcode.get(tenant_id, String(item.barcode).trim());
        }
        if (!existing && item.code && String(item.code).trim()) {
          existing = checkByBarcode.get(tenant_id, String(item.code).trim());
        }
        if (!existing && item.name) {
          existing = checkByName.get(tenant_id, item.name);
        }

        if (existing && update_existing) {
          if (item.is_promotion === 1 && item.original_price > 0) {
            updatePromoProd.run({
              original_price: Number(item.original_price),
              sale_price: Number(item.sale_price),
              id: existing.id
            });
            promosUpdatedCount++;
          } else {
            updateStockProd.run({
              sale_price: Number(item.sale_price) || 0,
              original_price: Number(item.original_price) || Number(item.sale_price) || 0,
              cost_price: Number(item.cost_price) || 0,
              stock_quantity: item.stock_quantity !== undefined ? Number(item.stock_quantity) : -1,
              manufacturer: item.manufacturer || '',
              supplier_id: itemSupplierId || null,
              id: existing.id
            });
          }

          if (itemSupplierId) {
            try {
              upsertProductSupplier.run(tenant_id, existing.id, itemSupplierId);
            } catch (e) {}
          }

          updatedCount++;
        } else if (!existing) {
          const res = insertProd.run({
            tenant_id,
            name: item.name,
            active_ingredient: item.active_ingredient || '',
            manufacturer: item.manufacturer || '',
            dosage: item.dosage || '',
            form: item.form || 'Comprimido',
            presentation: item.presentation || '',
            barcode: item.barcode || item.code || '',
            cost_price: Number(item.cost_price) || 0,
            sale_price: Number(item.sale_price) || 0,
            original_price: item.original_price ? Number(item.original_price) : Number(item.sale_price) || 0,
            is_promotion: item.is_promotion ? 1 : 0,
            stock_quantity: Number(item.stock_quantity) || 10,
            min_stock: Number(item.min_stock) || 5,
            requires_prescription: item.requires_prescription ? 1 : 0,
            prescription_type: item.prescription_type || 'livre',
            category: item.category || 'Medicamentos',
            supplier_id: itemSupplierId || null
          });

          if (itemSupplierId && res.lastInsertRowid) {
            try {
              upsertProductSupplier.run(tenant_id, res.lastInsertRowid, itemSupplierId);
            } catch (e) {}
          }

          createdCount++;
        }
      }
      return { 
        created: createdCount, 
        updated: updatedCount, 
        promos_updated: promosUpdatedCount, 
        total: createdCount + updatedCount,
        is_promotions: isPromoBatch
      };
    });

    const stats = processMany(products);
    res.json({ success: true, ...stats, imported: stats.total });
  } catch (err) {
    console.error('Erro em batch-import:', err);
    res.status(500).json({ error: 'Erro ao processar importação: ' + err.message });
  }
});

// POST /api/products/sync-drogarosa
router.post('/sync-drogarosa', authenticateToken, requireAdmin, (req, res) => {
  try {
    const tenantId = req.body.tenant_id || 1;
    const { importDrogarosaCatalog } = require('../db/importDrogarosa');
    const result = importDrogarosaCatalog(tenantId, db);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao sincronizar catálogo DrogaRosa: ' + err.message });
  }
});

module.exports = router;

