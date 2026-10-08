const express = require('express');
const router = express.Router();
const db = require('../db/database');
const botEngine = require('../bot/botEngine');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Helper to bind a supplier to a list of manufacturers
 * @param {number} tenantId
 * @param {number} supplierId
 * @param {string[]|string} manufacturersList
 * @param {'overwrite'|'only_empty'|'save_only'} strategy
 */
function bindSupplierToManufacturers(tenantId, supplierId, manufacturersList, strategy = 'overwrite') {
  if (!Array.isArray(manufacturersList)) {
    if (typeof manufacturersList === 'string') {
      try {
        manufacturersList = JSON.parse(manufacturersList);
      } catch (e) {
        manufacturersList = manufacturersList.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else {
      manufacturersList = [];
    }
  }

  const cleanMfrs = Array.from(
    new Set(manufacturersList.map((m) => String(m).trim()).filter(Boolean))
  );
  const jsonMfrs = JSON.stringify(cleanMfrs);

  // 1. Update suppliers table with JSON manufacturers
  db.prepare('UPDATE suppliers SET manufacturers = ? WHERE id = ?').run(jsonMfrs, supplierId);

  // 2. Re-populate supplier_manufacturers table
  db.prepare('DELETE FROM supplier_manufacturers WHERE supplier_id = ? AND tenant_id = ?').run(
    supplierId,
    tenantId
  );
  const insertMfr = db.prepare(
    'INSERT INTO supplier_manufacturers (tenant_id, supplier_id, manufacturer) VALUES (?, ?, ?)'
  );
  for (const mfr of cleanMfrs) {
    insertMfr.run(tenantId, supplierId, mfr);
  }

  if (cleanMfrs.length === 0 || strategy === 'save_only') {
    return { affected: 0, total: 0, strategy, manufacturers: cleanMfrs };
  }

  // 3. Find matching active products by manufacturer (case-insensitive)
  const matchingProducts = db.prepare(`
    SELECT id, supplier_id, manufacturer FROM products
    WHERE tenant_id = ? AND active = 1 AND UPPER(TRIM(manufacturer)) IN (${cleanMfrs.map(() => 'UPPER(?)').join(',')})
  `).all(tenantId, ...cleanMfrs);

  let affectedCount = 0;
  const updateProdSupplier = db.prepare('UPDATE products SET supplier_id = ? WHERE id = ?');
  const upsertProductSupplier = db.prepare(`
    INSERT INTO product_suppliers (tenant_id, product_id, supplier_id, is_primary)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(product_id, supplier_id) DO UPDATE SET is_primary = excluded.is_primary
  `);
  const demoteOtherSuppliers = db.prepare(`
    UPDATE product_suppliers SET is_primary = 0 WHERE product_id = ? AND supplier_id != ?
  `);

  db.transaction(() => {
    for (const prod of matchingProducts) {
      if (strategy === 'overwrite') {
        // Overwrite primary supplier on products table
        updateProdSupplier.run(supplierId, prod.id);
        demoteOtherSuppliers.run(prod.id, supplierId);
        upsertProductSupplier.run(tenantId, prod.id, supplierId, 1);
        affectedCount++;
      } else if (strategy === 'only_empty') {
        // Only update if product currently has no supplier
        if (!prod.supplier_id || prod.supplier_id === 0) {
          updateProdSupplier.run(supplierId, prod.id);
          demoteOtherSuppliers.run(prod.id, supplierId);
          upsertProductSupplier.run(tenantId, prod.id, supplierId, 1);
          affectedCount++;
        } else {
          // Keep existing primary supplier, but register this supplier as secondary (is_primary = 0)
          upsertProductSupplier.run(tenantId, prod.id, supplierId, 0);
        }
      }
    }
  })();

  return { affected: affectedCount, total: matchingProducts.length, strategy, manufacturers: cleanMfrs };
}

// GET /api/suppliers/manufacturers - List all manufacturers with product counts and assigned suppliers
router.get('/manufacturers', authenticateToken, (req, res) => {
  const tenantId = req.query.tenant_id || 1;

  try {
    const list = db.prepare(`
      SELECT 
        TRIM(p.manufacturer) as name,
        COUNT(*) as product_count,
        SUM(CASE WHEN p.supplier_id IS NOT NULL AND p.supplier_id > 0 THEN 1 ELSE 0 END) as with_supplier_count
      FROM products p
      WHERE p.tenant_id = ? AND p.active = 1 AND p.manufacturer IS NOT NULL AND TRIM(p.manufacturer) != ''
      GROUP BY TRIM(p.manufacturer)
      ORDER BY product_count DESC, name ASC
    `).all(tenantId);

    // Fetch suppliers assigned to these manufacturers
    const assigned = db.prepare(`
      SELECT sm.manufacturer, s.id as supplier_id, s.name as supplier_name, s.company as supplier_company
      FROM supplier_manufacturers sm
      JOIN suppliers s ON sm.supplier_id = s.id
      WHERE sm.tenant_id = ? AND s.active = 1
    `).all(tenantId);

    const assignedMap = {};
    for (const row of assigned) {
      const key = (row.manufacturer || '').trim().toUpperCase();
      if (!assignedMap[key]) assignedMap[key] = [];
      assignedMap[key].push({
        id: row.supplier_id,
        name: row.supplier_name,
        company: row.supplier_company,
      });
    }

    const result = list.map((m) => {
      const key = (m.name || '').trim().toUpperCase();
      return {
        ...m,
        assigned_suppliers: assignedMap[key] || [],
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar fabricantes: ' + err.message });
  }
});

// GET /api/suppliers/product/:productId/suppliers - Get all suppliers linked to a product
router.get('/product/:productId/suppliers', authenticateToken, (req, res) => {
  const productId = req.params.productId;

  try {
    const prod = db.prepare('SELECT id, tenant_id, supplier_id, manufacturer FROM products WHERE id = ?').get(productId);
    if (!prod) return res.status(404).json({ error: 'Produto não encontrado.' });

    let linked = db.prepare(`
      SELECT s.id, s.name, s.company, s.phone, s.email, ps.is_primary, ps.created_at
      FROM product_suppliers ps
      JOIN suppliers s ON ps.supplier_id = s.id
      WHERE ps.product_id = ? AND s.active = 1
      ORDER BY ps.is_primary DESC, s.name ASC
    `).all(productId);

    // Fallback if product_suppliers has not been filled yet but product has supplier_id
    if (linked.length === 0 && prod.supplier_id) {
      const supp = db.prepare('SELECT id, name, company, phone, email, 1 as is_primary FROM suppliers WHERE id = ? AND active = 1').get(prod.supplier_id);
      if (supp) linked = [supp];
    }

    // Also find any potential suppliers who cover this product's manufacturer
    let mfrSuppliers = [];
    if (prod.manufacturer && prod.manufacturer.trim()) {
      mfrSuppliers = db.prepare(`
        SELECT DISTINCT s.id, s.name, s.company, s.phone, s.email
        FROM supplier_manufacturers sm
        JOIN suppliers s ON sm.supplier_id = s.id
        WHERE sm.tenant_id = ? AND UPPER(TRIM(sm.manufacturer)) = UPPER(TRIM(?)) AND s.active = 1
      `).all(prod.tenant_id, prod.manufacturer.trim());
    }

    res.json({
      product_id: prod.id,
      primary_supplier_id: prod.supplier_id,
      linked_suppliers: linked,
      manufacturer_suppliers: mfrSuppliers,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar vendedores do produto: ' + err.message });
  }
});

// POST /api/suppliers/bind-manufacturers - Explicit batch bind route
router.post('/bind-manufacturers', authenticateToken, requireAdmin, (req, res) => {
  const { tenant_id = 1, supplier_id, manufacturers, strategy = 'overwrite' } = req.body;

  if (!supplier_id) {
    return res.status(400).json({ error: 'ID do fornecedor/vendedor é obrigatório.' });
  }

  try {
    const result = bindSupplierToManufacturers(tenant_id, supplier_id, manufacturers, strategy);
    res.json({
      success: true,
      message: `${result.affected} produtos vinculados com sucesso!`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao vincular fabricantes: ' + err.message });
  }
});

// GET /api/suppliers?tenant_id=1
router.get('/', authenticateToken, (req, res) => {
  const tenantId = req.query.tenant_id || 1;

  try {
    const suppliers = db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1) as product_count,
             (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1 AND p.stock_quantity <= p.min_stock) as low_stock_count
      FROM suppliers s
      WHERE s.tenant_id = ? AND s.active = 1
      ORDER BY s.name ASC
    `).all(tenantId);

    // Parse manufacturers array for each supplier
    for (const s of suppliers) {
      if (s.manufacturers) {
        try {
          s.manufacturers = JSON.parse(s.manufacturers);
        } catch (e) {
          s.manufacturers = String(s.manufacturers).split(',').map((m) => m.trim()).filter(Boolean);
        }
      } else {
        // Fallback to supplier_manufacturers table
        const rows = db.prepare('SELECT manufacturer FROM supplier_manufacturers WHERE supplier_id = ?').all(s.id);
        s.manufacturers = rows.map((r) => r.manufacturer);
      }
    }

    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar fornecedores/vendedores: ' + err.message });
  }
});

// GET /api/suppliers/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Vendedor não encontrado.' });

    if (supplier.manufacturers) {
      try {
        supplier.manufacturers = JSON.parse(supplier.manufacturers);
      } catch (e) {
        supplier.manufacturers = String(supplier.manufacturers).split(',').map((m) => m.trim()).filter(Boolean);
      }
    } else {
      const rows = db.prepare('SELECT manufacturer FROM supplier_manufacturers WHERE supplier_id = ?').all(supplier.id);
      supplier.manufacturers = rows.map((r) => r.manufacturer);
    }

    const products = db.prepare(`
      SELECT id, name, dosage, presentation, manufacturer, stock_quantity, min_stock, sale_price
      FROM products
      WHERE supplier_id = ? AND active = 1
      ORDER BY name ASC
    `).all(req.params.id);

    res.json({ ...supplier, products });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar vendedor: ' + err.message });
  }
});

// POST /api/suppliers
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { tenant_id = 1, name, phone, company, email, notes, manufacturers = [], binding_strategy = 'overwrite' } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone/WhatsApp do vendedor são obrigatórios.' });
  }

  // Clean phone to ensure digits only or proper format
  const cleanPhone = String(phone).replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 
    ? '55' + cleanPhone 
    : cleanPhone;

  try {
    const insert = db.prepare(`
      INSERT INTO suppliers (tenant_id, name, phone, company, email, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      tenant_id,
      name.trim(),
      formattedPhone,
      company ? company.trim() : '',
      email ? email.trim() : '',
      notes ? notes.trim() : ''
    );

    const supplierId = result.lastInsertRowid;

    // Process manufacturers binding if provided
    let bindStats = null;
    if (manufacturers && (Array.isArray(manufacturers) || typeof manufacturers === 'string')) {
      bindStats = bindSupplierToManufacturers(tenant_id, supplierId, manufacturers, binding_strategy);
    }

    const created = db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1) as product_count,
             (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1 AND p.stock_quantity <= p.min_stock) as low_stock_count
      FROM suppliers s
      WHERE s.id = ?
    `).get(supplierId);

    if (created && created.manufacturers) {
      try {
        created.manufacturers = JSON.parse(created.manufacturers);
      } catch (e) {
        created.manufacturers = [];
      }
    } else if (created) {
      created.manufacturers = [];
    }

    res.status(201).json({ ...created, bind_stats: bindStats });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar vendedor: ' + err.message });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const id = req.params.id;
  const { name, phone, company, email, notes, active, manufacturers, binding_strategy = 'overwrite' } = req.body;

  let formattedPhone = phone;
  if (phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 
      ? '55' + cleanPhone 
      : cleanPhone;
  }

  try {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Vendedor não encontrado.' });

    db.prepare(`
      UPDATE suppliers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        company = COALESCE(?, company),
        email = COALESCE(?, email),
        notes = COALESCE(?, notes),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : null,
      formattedPhone || null,
      company !== undefined ? company.trim() : null,
      email !== undefined ? email.trim() : null,
      notes !== undefined ? notes.trim() : null,
      active !== undefined ? (active ? 1 : 0) : null,
      id
    );

    // Process manufacturers binding if supplied
    let bindStats = null;
    if (manufacturers !== undefined) {
      bindStats = bindSupplierToManufacturers(existing.tenant_id, id, manufacturers, binding_strategy);
    }

    const updated = db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1) as product_count,
             (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1 AND p.stock_quantity <= p.min_stock) as low_stock_count
      FROM suppliers s
      WHERE s.id = ?
    `).get(id);

    if (updated && updated.manufacturers) {
      try {
        updated.manufacturers = JSON.parse(updated.manufacturers);
      } catch (e) {
        updated.manufacturers = [];
      }
    } else if (updated) {
      updated.manufacturers = [];
    }

    res.json({ ...updated, bind_stats: bindStats });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar vendedor: ' + err.message });
  }
});

// DELETE /api/suppliers/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const id = req.params.id;
  try {
    db.prepare('UPDATE suppliers SET active = 0 WHERE id = ?').run(id);
    res.json({ success: true, message: 'Vendedor/representante removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover vendedor: ' + err.message });
  }
});

// POST /api/suppliers/notify-low-stock/:productId
// Manual action: Pharmacist clicks "Avisar Vendedor Agora"
router.post('/notify-low-stock/:productId', authenticateToken, requireAdmin, async (req, res) => {
  const productId = req.params.productId;

  try {
    const prod = db.prepare(`
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.company as supplier_company
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(productId);

    if (!prod) return res.status(404).json({ error: 'Medicamento não encontrado.' });
    if (!prod.supplier_id || !prod.supplier_phone) {
      return res.status(400).json({ error: 'Este medicamento não possui um vendedor/representante cadastrado com WhatsApp.' });
    }

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(prod.tenant_id);

    const alertMsg = `📦 *SOLICITAÇÃO DE COTAÇÃO E REPOSIÇÃO* 🚨\n\n` +
      `Olá, *${prod.supplier_name}*!\n\n` +
      `A equipe da *${tenant.name}* informa que o medicamento abaixo precisa de atenção e reposição em nosso estoque:\n\n` +
      `💊 *Medicamento:* ${prod.name} ${prod.dosage || ''}\n` +
      `📦 *Apresentação:* ${prod.presentation || prod.form || 'Unidade'}\n` +
      `🏭 *Laboratório / Fabricante:* ${prod.manufacturer || 'Não informado'}\n` +
      `📊 *Estoque Atual:* ${prod.stock_quantity} unidades\n` +
      `⚠️ *Estoque Mínimo:* ${prod.min_stock} unidades\n\n` +
      `👉 Por favor, envie cotação com lote atual e prazo de entrega para novo pedido.\n\n` +
      `Atenciosamente,\n*${tenant.name}*\nWhatsApp: ${tenant.phone || ''}`;

    const sent = await botEngine.sendReply(prod.tenant_id, prod.supplier_phone, alertMsg);

    if (!sent) {
      return res.json({
        success: false,
        whatsappConnected: false,
        error: 'O WhatsApp da farmácia não está conectado no momento. Acesse a aba "Conexão WhatsApp" no menu lateral e leia o QR Code com o celular da farmácia para ativar o envio real das mensagens.',
      });
    }

    db.prepare('UPDATE products SET last_stock_alert_at = CURRENT_TIMESTAMP WHERE id = ?').run(productId);

    try {
      db.prepare(`
        INSERT INTO audit_logs (tenant_id, user_name, action, details)
        VALUES (?, ?, 'ALERTA_VENDEDOR_MANUAL', ?)
      `).run(prod.tenant_id, req.body.sent_by || 'Farmacêutico', `Alerta manual enviado para ${prod.supplier_name} sobre ${prod.name}.`);
    } catch (e) {}

    res.json({
      success: true,
      whatsappConnected: true,
      message: `Mensagem enviada com sucesso para o representante ${prod.supplier_name} (${prod.supplier_phone})!`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar mensagem para o vendedor: ' + err.message });
  }
});

// POST /api/suppliers/quote-multivendor/:productId
// Dispatches WhatsApp quote requests to ALL suppliers associated with this product or its manufacturer
router.post('/quote-multivendor/:productId', authenticateToken, requireAdmin, async (req, res) => {
  const productId = req.params.productId;

  try {
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!prod) return res.status(404).json({ error: 'Medicamento não encontrado.' });

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(prod.tenant_id);

    // 1. Gather all supplier candidates
    const supplierIds = new Set();
    if (prod.supplier_id) supplierIds.add(prod.supplier_id);

    const productSupps = db.prepare('SELECT supplier_id FROM product_suppliers WHERE product_id = ?').all(productId);
    for (const ps of productSupps) supplierIds.add(ps.supplier_id);

    if (prod.manufacturer && prod.manufacturer.trim()) {
      const mfrSupps = db.prepare(`
        SELECT supplier_id FROM supplier_manufacturers 
        WHERE tenant_id = ? AND UPPER(TRIM(manufacturer)) = UPPER(TRIM(?))
      `).all(prod.tenant_id, prod.manufacturer.trim());
      for (const ms of mfrSupps) supplierIds.add(ms.supplier_id);
    }

    if (supplierIds.size === 0) {
      return res.status(400).json({
        error: 'Nenhum vendedor ou representante cadastrado para este medicamento ou fabricante.',
      });
    }

    const idsList = Array.from(supplierIds);
    const suppliers = db.prepare(`
      SELECT * FROM suppliers 
      WHERE id IN (${idsList.map(() => '?').join(',')}) AND active = 1 AND phone IS NOT NULL AND phone != ''
    `).all(...idsList);

    if (suppliers.length === 0) {
      return res.status(400).json({
        error: 'Nenhum dos vendedores vinculados possui número de WhatsApp válido e ativo.',
      });
    }

    const quoteMsgTemplate = (supp) =>
      `📦 *SOLICITAÇÃO DE COTAÇÃO MULTIVENDEDOR* 🚨\n\n` +
      `Olá, *${supp.name}*!\n\n` +
      `A equipe da *${tenant.name}* solicita cotação de reposição para o seguinte item:\n\n` +
      `💊 *Medicamento:* ${prod.name} ${prod.dosage || ''}\n` +
      `📦 *Apresentação:* ${prod.presentation || prod.form || 'Unidade'}\n` +
      `🏭 *Laboratório / Fabricante:* ${prod.manufacturer || 'Não informado'}\n` +
      `📊 *Estoque Atual:* ${prod.stock_quantity} unidades\n` +
      `⚠️ *Estoque Mínimo:* ${prod.min_stock} unidades\n\n` +
      `👉 Por favor, envie seu menor preço unitário, validade do lote e previsão de entrega.\n\n` +
      `Atenciosamente,\n*${tenant.name}*\nWhatsApp: ${tenant.phone || ''}`;

    let sentCount = 0;
    const sentSuppliers = [];

    for (const supp of suppliers) {
      const msg = quoteMsgTemplate(supp);
      const ok = await botEngine.sendReply(prod.tenant_id, supp.phone, msg);
      if (ok) {
        sentCount++;
        sentSuppliers.push({ id: supp.id, name: supp.name, phone: supp.phone, company: supp.company });
      }
    }

    if (sentCount > 0) {
      db.prepare('UPDATE products SET last_stock_alert_at = CURRENT_TIMESTAMP WHERE id = ?').run(productId);
      try {
        db.prepare(`
          INSERT INTO audit_logs (tenant_id, user_name, action, details)
          VALUES (?, ?, 'COTACAO_MULTIVENDEDOR_WHATSAPP', ?)
        `).run(
          prod.tenant_id,
          req.body.sent_by || 'Farmacêutico',
          `Cotação multivendedor enviada para ${sentCount} vendedor(es) sobre ${prod.name}.`
        );
      } catch (e) {}

      res.json({
        success: true,
        whatsappConnected: true,
        sentCount,
        contacted: sentSuppliers,
        message: `Cotação disparada com sucesso para ${sentCount} vendedor(es)!`,
      });
    } else {
      res.json({
        success: false,
        whatsappConnected: false,
        error: 'Não foi possível enviar mensagens no momento. Verifique se o WhatsApp da farmácia está conectado no painel.',
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao disparar cotação multivendedor: ' + err.message });
  }
});

// POST /api/suppliers/:id/test-whatsapp
// Direct action: Test WhatsApp delivery to this specific supplier
router.post('/:id/test-whatsapp', authenticateToken, requireAdmin, async (req, res) => {
  const supplierId = req.params.id;
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supplier) return res.status(404).json({ error: 'Vendedor não encontrado.' });
    if (!supplier.phone) return res.status(400).json({ error: 'Este vendedor não possui número de WhatsApp cadastrado.' });

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(supplier.tenant_id);

    // Get any sample product from this supplier or default example
    const sampleProd = db.prepare('SELECT * FROM products WHERE tenant_id = ? AND supplier_id = ? LIMIT 1').get(supplier.tenant_id, supplier.id);
    const prodName = sampleProd ? `${sampleProd.name} ${sampleProd.dosage || ''}` : 'Dipirona Sódica 500mg Gotas (Exemplo)';
    const prodStock = sampleProd ? sampleProd.stock_quantity : 2;
    const prodMin = sampleProd ? sampleProd.min_stock : 10;

    const testMsg = `📦 *TESTE DE INTEGRAÇÃO - ZAPFARM* 🚨\n\n` +
      `Olá, *${supplier.name}*!\n\n` +
      `Este é um teste do canal de alerta automático de estoque da *${tenant.name}*.\n\n` +
      `Sempre que um medicamento fornecido por você (${supplier.company || 'sua distribuidora'}) atingir o nível mínimo de reposição, o robô enviará uma notificação automática como esta:\n\n` +
      `💊 *Medicamento:* ${prodName}\n` +
      `📊 *Estoque Atual:* ${prodStock} unidades\n` +
      `⚠️ *Estoque Mínimo:* ${prodMin} unidades\n\n` +
      `👉 Por favor, envie cotação atualizada e prazo de entrega para novo pedido.\n\n` +
      `Atenciosamente,\n*${tenant.name}*\nWhatsApp: ${tenant.phone || ''}`;

    const sent = await botEngine.sendReply(supplier.tenant_id, supplier.phone, testMsg);

    if (!sent) {
      return res.json({
        success: false,
        whatsappConnected: false,
        error: 'O WhatsApp da farmácia não está conectado no momento. Acesse a aba "Conexão WhatsApp" no menu lateral e leia o QR Code com o celular da farmácia para ativar o envio real das mensagens.',
      });
    }

    try {
      db.prepare(`
        INSERT INTO audit_logs (tenant_id, user_name, action, details)
        VALUES (?, ?, 'TESTE_WHATSAPP_VENDEDOR', ?)
      `).run(supplier.tenant_id, req.body.sent_by || 'Farmacêutico', `Teste de WhatsApp enviado para ${supplier.name} (${supplier.phone}).`);
    } catch (e) {}

    res.json({
      success: true,
      whatsappConnected: true,
      message: `Mensagem teste entregue com sucesso no WhatsApp de ${supplier.name} (${supplier.phone})!`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar teste de WhatsApp: ' + err.message });
  }
});

module.exports = router;
