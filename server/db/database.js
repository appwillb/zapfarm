const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Ensure data directory exists
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'zapfarm.db');
const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      cnpj TEXT,
      phone TEXT,
      email TEXT,
      plan TEXT DEFAULT 'pro',
      status TEXT DEFAULT 'active',
      pix_key TEXT,
      pix_type TEXT DEFAULT 'cnpj',
      delivery_fee_default REAL DEFAULT 7.00,
      free_shipping_threshold REAL DEFAULT 120.00,
      address TEXT,
      business_hours TEXT DEFAULT '08:00 às 22:00',
      welcome_message TEXT DEFAULT 'Olá! Bem-vindo(a) à {nome}. Qual medicamento ou produto você procura hoje?',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      active_ingredient TEXT,
      manufacturer TEXT,
      dosage TEXT,
      form TEXT,
      presentation TEXT,
      barcode TEXT,
      cost_price REAL DEFAULT 0.0,
      sale_price REAL NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      reserved_quantity INTEGER DEFAULT 0,
      requires_prescription INTEGER DEFAULT 0,
      prescription_type TEXT DEFAULT 'livre',
      category TEXT DEFAULT 'Medicamentos',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date DATE NOT NULL,
      quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS delivery_drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle TEXT DEFAULT 'Moto',
      plate TEXT,
      status TEXT DEFAULT 'available',
      fee_amount REAL DEFAULT 7.00,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_name TEXT,
      delivery_type TEXT DEFAULT 'delivery',
      delivery_address TEXT,
      delivery_fee REAL DEFAULT 0.0,
      subtotal REAL DEFAULT 0.0,
      total REAL DEFAULT 0.0,
      status TEXT DEFAULT 'pending_payment',
      pix_code TEXT,
      pix_qrcode_url TEXT,
      payment_method TEXT DEFAULT 'PIX',
      payment_confirmed_at DATETIME,
      confirmed_by_user TEXT,
      driver_id INTEGER,
      driver_notified_at DATETIME,
      notes TEXT,
      prescription_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (driver_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      dosage TEXT,
      presentation TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_name TEXT,
      state TEXT DEFAULT 'idle',
      context_data TEXT DEFAULT '{}',
      is_human_agent INTEGER DEFAULT 0,
      last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, customer_phone)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      customer_phone TEXT NOT NULL,
      from_me INTEGER DEFAULT 0,
      text TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_products_search ON products(tenant_id, name, active_ingredient, barcode);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(tenant_id, customer_phone);
    CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(tenant_id, customer_phone);
  `);

  seedData();
}

function seedData() {
  const countTenants = db.prepare('SELECT COUNT(*) as count FROM tenants').get().count;
  if (countTenants > 0) return;

  console.log('🌱 Inicializando banco de dados com dados reais da farmácia e SaaS...');

  // 1. Criar Farmácia Principal
  const insertTenant = db.prepare(`
    INSERT INTO tenants (slug, name, cnpj, phone, email, plan, status, pix_key, pix_type, delivery_fee_default, free_shipping_threshold, address, business_hours, welcome_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tenantResult = insertTenant.run(
    'farmacia-central',
    'Farmácia Central & Drogaria Vida',
    '12.345.678/0001-90',
    '5511988887777',
    'contato@farmaciacentral.com.br',
    'pro',
    'active',
    '12345678000190',
    'cnpj',
    7.00,
    100.00,
    'Av. Principal, 1500 - Centro, São Paulo - SP',
    '08:00 às 22:00',
    'Olá! Bem-vindo(a) à Farmácia Central. 💊\nQual remédio ou produto de saúde você procura hoje?'
  );

  const tenantId = tenantResult.lastInsertRowid;

  // Farmácia 2 (Demonstrativo SaaS Multi-tenant)
  insertTenant.run(
    'drogaria-bairro-novo',
    'Drogaria Bairro Novo',
    '98.765.432/0001-10',
    '5511977776666',
    'contato@bairronovo.com.br',
    'starter',
    'active',
    '98765432000110',
    'cnpj',
    5.00,
    80.00,
    'Rua das Palmeiras, 320 - Bairro Novo',
    '07:00 às 23:00',
    'Olá! Drogaria Bairro Novo ao seu dispor. O que você precisa hoje?'
  );

  // 2. Usuários
  const passwordHash = bcrypt.hashSync('admin123', 10);
  const insertUser = db.prepare(`
    INSERT INTO users (tenant_id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Super Admin da plataforma SaaS (acesso global a todas as farmácias)
  insertUser.run(null, 'Administrador ZapFarm SaaS', 'admin@zapfarm.com', passwordHash, 'superadmin');

  // Farmacêutico / Gerente da Farmácia Central
  insertUser.run(tenantId, 'Dra. Camila (Farmacêutica)', 'camila@farmaciacentral.com.br', passwordHash, 'pharmacist');
  insertUser.run(tenantId, 'Atendente Lucas', 'lucas@farmaciacentral.com.br', passwordHash, 'attendant');

  // 3. Medicamentos / Catálogo Completo
  const insertProduct = db.prepare(`
    INSERT INTO products (
      tenant_id, name, active_ingredient, manufacturer, dosage, form, presentation, barcode,
      cost_price, sale_price, stock_quantity, min_stock, reserved_quantity, requires_prescription, prescription_type, category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleProducts = [
    {
      name: 'Dipirona Monoidratada',
      active_ingredient: 'Dipirona Sódica',
      manufacturer: 'EMS Genéricos',
      dosage: '500mg',
      form: 'Comprimido',
      presentation: 'Caixa com 20 comprimidos',
      barcode: '7896004702111',
      cost_price: 3.50,
      sale_price: 8.90,
      stock: 45,
      prescription: 0,
      prescription_type: 'livre',
      category: 'Analgésicos e Antitérmicos'
    },
    {
      name: 'Dipirona Monoidratada Gotas',
      active_ingredient: 'Dipirona Sódica',
      manufacturer: 'Medley',
      dosage: '500mg/ml',
      form: 'Gotas',
      presentation: 'Frasco conta-gotas 20ml',
      barcode: '7896004702112',
      cost_price: 4.20,
      sale_price: 11.50,
      stock: 32,
      prescription: 0,
      prescription_type: 'livre',
      category: 'Analgésicos e Antitérmicos'
    },
    {
      name: 'Dipirona Monoidratada 1g',
      active_ingredient: 'Dipirona Sódica',
      manufacturer: 'Eurofarma',
      dosage: '1000mg (1g)',
      form: 'Comprimido Efervescente',
      presentation: 'Caixa com 10 comprimidos',
      barcode: '7896004702113',
      cost_price: 6.80,
      sale_price: 16.90,
      stock: 28,
      prescription: 0,
      prescription_type: 'livre',
      category: 'Analgésicos e Antitérmicos'
    },
    {
      name: 'Paracetamol',
      active_ingredient: 'Paracetamol',
      manufacturer: 'Neo Química',
      dosage: '750mg',
      form: 'Comprimido',
      presentation: 'Blister com 20 comprimidos',
      barcode: '7896714203114',
      cost_price: 4.50,
      sale_price: 12.00,
      stock: 50,
      prescription: 0,
      prescription_type: 'livre',
      category: 'Analgésicos e Antitérmicos'
    },
    {
      name: 'Amoxicilina + Clavulanato',
      active_ingredient: 'Amoxicilina Tri-hidratada',
      manufacturer: 'Sandoz',
      dosage: '500mg + 125mg',
      form: 'Comprimido Revestido',
      presentation: 'Caixa com 21 comprimidos',
      barcode: '7896004705544',
      cost_price: 28.00,
      sale_price: 54.90,
      stock: 15,
      prescription: 1,
      prescription_type: 'antibiotico',
      category: 'Antibióticos'
    },
    {
      name: 'Ibuprofeno',
      active_ingredient: 'Ibuprofeno',
      manufacturer: 'Aché',
      dosage: '600mg',
      form: 'Cápsula Mole',
      presentation: 'Caixa com 20 cápsulas',
      barcode: '7896004707788',
      cost_price: 8.00,
      sale_price: 18.50,
      stock: 30,
      prescription: 0,
      prescription_type: 'livre',
      category: 'Anti-inflamatórios'
    },
    {
      name: 'Dorflex',
      active_ingredient: 'Dipirona + Orfenadrina + Cafeína',
      manufacturer: 'Sanofi Aventis',
      dosage: '300mg + 35mg + 50mg',
      form: 'Comprimido',
      presentation: 'Cartela com 10 comprimidos',
      barcode: '7891058001010',
      cost_price: 3.80,
      sale_price: 9.50,
      stock: 60,
      prescription: 0,
      prescription_type: 'livre',
      category: 'Relaxante Muscular'
    },
    {
      name: 'Omeprazol',
      active_ingredient: 'Omeprazol',
      manufacturer: 'Medley',
      dosage: '20mg',
      form: 'Cápsula',
      presentation: 'Frasco com 28 cápsulas',
      barcode: '7896422501025',
      cost_price: 6.00,
      sale_price: 15.90,
      stock: 25,
      prescription: 0,
      prescription_type: 'livre',
      category: 'Gastroenterologia'
    },
    {
      name: 'Losartana Potássica',
      active_ingredient: 'Losartana Potássica',
      manufacturer: 'Teuto',
      dosage: '50mg',
      form: 'Comprimido Revestido',
      presentation: 'Caixa com 30 comprimidos',
      barcode: '7896112101099',
      cost_price: 4.00,
      sale_price: 10.90,
      stock: 40,
      prescription: 1,
      prescription_type: 'tarja_vermelha',
      category: 'Cardiovascular'
    },
    {
      name: 'Neosaldina',
      active_ingredient: 'Dipirona + Mucato de Isometepteno + Cafeína',
      manufacturer: 'Takeda',
      dosage: 'Drágea',
      form: 'Drágea',
      presentation: 'Cartela com 10 drágeas',
      barcode: '7896094200055',
      cost_price: 7.20,
      sale_price: 17.50,
      stock: 4, // Estoque baixo para testar alerta!
      prescription: 0,
      prescription_type: 'livre',
      category: 'Enxaqueca e Dores de Cabeça'
    }
  ];

  const insertBatch = db.prepare(`
    INSERT INTO batches (tenant_id, product_id, batch_number, expiry_date, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const item of sampleProducts) {
    const prodRes = insertProduct.run(
      tenantId,
      item.name,
      item.active_ingredient,
      item.manufacturer,
      item.dosage,
      item.form,
      item.presentation,
      item.barcode,
      item.cost_price,
      item.sale_price,
      item.stock,
      5,
      0,
      item.prescription,
      item.prescription_type,
      item.category
    );

    const prodId = prodRes.lastInsertRowid;
    // Add sample batch
    insertBatch.run(tenantId, prodId, `LT-${Math.floor(100000 + Math.random() * 900000)}`, '2027-12-31', item.stock);
  }

  // 4. Entregadores (Motoboys)
  const insertDriver = db.prepare(`
    INSERT INTO delivery_drivers (tenant_id, name, phone, vehicle, plate, status, fee_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertDriver.run(tenantId, 'Carlos Alberto (Motoboy 1)', '5511999991111', 'Honda CG 160 Titan', 'BRA-2E19', 'available', 7.00);
  insertDriver.run(tenantId, 'Marcos Silva (Motoboy 2)', '5511999992222', 'Yamaha Fazer 250', 'FZR-4A88', 'available', 7.00);
  insertDriver.run(tenantId, 'Roberto Motofast', '5511999993333', 'Honda Biz 125', 'BIZ-9K32', 'offline', 8.00);

  // 5. Pedidos de Amostra
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      tenant_id, customer_phone, customer_name, delivery_type, delivery_address, delivery_fee,
      subtotal, total, status, pix_code, pix_qrcode_url, payment_confirmed_at, confirmed_by_user, driver_id, driver_notified_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, dosage, presentation, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Pedido 1: Aguardando Pagamento
  const ord1 = insertOrder.run(
    tenantId,
    '5511987654321',
    'João Pereira',
    'delivery',
    'Rua das Acacias, 45 - Apto 22, Bairro Jardim',
    7.00,
    17.80,
    24.80,
    'pending_payment',
    '00020126580014br.gov.bcb.pix011412345678000190520400005303986540524.805802BR5925Farmacia Central6009SAO PAULO62070503***6304E1F2',
    'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=zapfarm_pix_sample_1',
    null,
    null,
    null,
    null,
    'Deixar na portaria'
  );
  insertOrderItem.run(ord1.lastInsertRowid, 1, 'Dipirona Monoidratada', '500mg', 'Caixa com 20 comprimidos', 2, 8.90, 17.80);

  // Pedido 2: Pago / Em Separação
  const ord2 = insertOrder.run(
    tenantId,
    '5511976543210',
    'Mariana Souza',
    'delivery',
    'Av. Brasil, 1200 - Casa 3',
    7.00,
    30.50,
    37.50,
    'paid',
    '00020126580014br.gov.bcb.pix011412345678000190520400005303986540537.505802BR5925Farmacia Central6009SAO PAULO62070503***6304ABCD',
    'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=zapfarm_pix_sample_2',
    new Date().toISOString(),
    'Dra. Camila (Farmacêutica)',
    null,
    null,
    'Campainha quebrada, ligar ao chegar'
  );
  insertOrderItem.run(ord2.lastInsertRowid, 4, 'Paracetamol', '750mg', 'Blister com 20 comprimidos', 1, 12.00, 12.00);
  insertOrderItem.run(ord2.lastInsertRowid, 6, 'Ibuprofeno', '600mg', 'Caixa com 20 cápsulas', 1, 18.50, 18.50);

  // Pedido 3: Em Rota com Entregador
  const ord3 = insertOrder.run(
    tenantId,
    '5511965432109',
    'Carlos Eduardo Rocha',
    'delivery',
    'Rua XV de Novembro, 780',
    7.00,
    54.90,
    61.90,
    'in_transit',
    '00020126580014br.gov.bcb.pix011412345678000190520400005303986540561.905802BR5925Farmacia Central6009SAO PAULO62070503***6304EEEE',
    'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=zapfarm_pix_sample_3',
    new Date(Date.now() - 3600000).toISOString(),
    'Dra. Camila (Farmacêutica)',
    1, // Carlos Alberto
    new Date(Date.now() - 1800000).toISOString(),
    'Receita conferida e retida'
  );
  insertOrderItem.run(ord3.lastInsertRowid, 5, 'Amoxicilina + Clavulanato', '500mg + 125mg', 'Caixa com 21 comprimidos', 1, 54.90, 54.90);

  // Registrar Log de Auditoria
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (tenant_id, user_name, action, details)
    VALUES (?, ?, ?, ?)
  `);
  insertAudit.run(tenantId, 'Sistema', 'INICIALIZACAO', 'Banco de dados criado e populado com sucesso.');

  console.log('✅ Banco de dados populado com sucesso!');
}

initDb();

module.exports = db;
