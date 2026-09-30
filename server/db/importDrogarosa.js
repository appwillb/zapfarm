const fs = require('fs');
const path = require('path');
const db = require('./database');

function importDrogarosaCatalog(tenantId = 1) {
  const jsonPath = path.join(__dirname, 'drogarosa_products.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Arquivo drogarosa_products.json não encontrado em: ${jsonPath}`);
  }

  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`[Import DrogaRosa] Iniciando importação de ${products.length} produtos para tenant ${tenantId}...`);

  // 1. Atualizar informações da Farmácia (Tenant 1)
  try {
    db.prepare(`
      UPDATE tenants
      SET name = 'DROGAROSA LTDA',
          cnpj = '01.698.505/0001-34',
          pix_key = '01698505000134',
          pix_type = 'cnpj',
          welcome_message = 'Olá! Bem-vindo(a) à DrogaRosa. 💊\nQual remédio ou produto de saúde você procura hoje?'
      WHERE id = ?
    `).run(tenantId);
    console.log(`[Import DrogaRosa] Tenant ${tenantId} atualizado para DROGAROSA LTDA.`);
  } catch (err) {
    console.warn(`[Import DrogaRosa] Aviso ao atualizar tenant:`, err.message);
  }

  // 2. Desativar produtos mock iniciais (que não são da Drogarosa)
  try {
    db.prepare(`
      UPDATE products
      SET active = 0
      WHERE tenant_id = ? AND LENGTH(barcode) <> 10
    `).run(tenantId);
  } catch (err) {
    console.warn(`[Import DrogaRosa] Aviso ao desativar mock products:`, err.message);
  }

  // 3. Preparar Statements para inserção / atualização atômica e rápida
  const checkStmt = db.prepare('SELECT id FROM products WHERE tenant_id = ? AND barcode = ?');
  const insertStmt = db.prepare(`
    INSERT INTO products (
      tenant_id, name, active_ingredient, manufacturer, dosage, form,
      presentation, barcode, cost_price, sale_price, stock_quantity,
      min_stock, reserved_quantity, requires_prescription, prescription_type,
      category, active, created_at
    ) VALUES (
      ?, @name, @active_ingredient, @manufacturer, @dosage, @form,
      @presentation, @barcode, @cost_price, @sale_price, @stock_quantity,
      @min_stock, @reserved_quantity, @requires_prescription, @prescription_type,
      @category, 1, datetime('now', 'localtime')
    )
  `);

  const updateStmt = db.prepare(`
    UPDATE products
    SET name = @name,
        active_ingredient = @active_ingredient,
        manufacturer = @manufacturer,
        dosage = @dosage,
        form = @form,
        presentation = @presentation,
        cost_price = @cost_price,
        sale_price = @sale_price,
        stock_quantity = @stock_quantity,
        min_stock = @min_stock,
        requires_prescription = @requires_prescription,
        prescription_type = @prescription_type,
        category = @category,
        active = 1
    WHERE id = ?
  `);

  let insertedCount = 0;
  let updatedCount = 0;

  const runTransaction = db.transaction((items) => {
    for (const p of items) {
      const existing = checkStmt.get(tenantId, p.barcode);
      if (existing) {
        updateStmt.run(p, existing.id);
        updatedCount++;
      } else {
        insertStmt.run(tenantId, p);
        insertedCount++;
      }
    }
  });

  const startTime = Date.now();
  runTransaction(products);
  const durationMs = Date.now() - startTime;

  console.log(`[Import DrogaRosa] Concluído em ${durationMs}ms:`);
  console.log(` - Inseridos: ${insertedCount}`);
  console.log(` - Atualizados: ${updatedCount}`);
  console.log(` - Total processado: ${insertedCount + updatedCount}`);

  // Registrar Log de Auditoria
  try {
    db.prepare(`
      INSERT INTO audit_logs (tenant_id, user_name, action, details)
      VALUES (?, ?, ?, ?)
    `).run(tenantId, 'Sistema', 'IMPORT_PRODUTOS_PDF', `Importados ${insertedCount} novos produtos e ${updatedCount} atualizados via Balanço PDF DrogaRosa.`);
  } catch (e) {}

  return { insertedCount, updatedCount, total: products.length, durationMs };
}

if (require.main === module) {
  importDrogarosaCatalog(1);
}

module.exports = { importDrogarosaCatalog };
