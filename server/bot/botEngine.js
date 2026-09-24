const db = require('../db/database');
const qrcode = require('qrcode');

// Helper to generate Brazilian PIX Copia e Cola (standard EMV payload)
function generatePixCode({ pixKey, pixType, merchantName, merchantCity, amount, txid }) {
  // Clean formatting
  const cleanKey = pixKey ? pixKey.replace(/[^\w@.-]/g, '') : '12345678000190';
  const cleanName = (merchantName || 'FARMACIA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 25).toUpperCase();
  const cleanCity = (merchantCity || 'SAO PAULO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 15).toUpperCase();
  const formattedAmount = Number(amount || 0).toFixed(2);
  const cleanTxid = (txid || 'ZAP' + Date.now()).substring(0, 25);

  function formatField(id, value) {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  }

  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', cleanKey);
  const accountInfo = formatField('26', `${gui}${keyField}`);

  const catCode = formatField('52', '0000');
  const currency = formatField('53', '986');
  const amountField = formatField('54', formattedAmount);
  const country = formatField('58', 'BR');
  const nameField = formatField('59', cleanName);
  const cityField = formatField('60', cleanCity);
  const txidField = formatField('05', cleanTxid);
  const additionalData = formatField('62', txidField);

  let payload = `000201${accountInfo}${catCode}${currency}${amountField}${country}${nameField}${cityField}${additionalData}6304`;

  // CRC16-CCITT calculation
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return payload + crcHex;
}

class BotEngine {
  constructor() {
    this.sendWhatsAppMessageFn = null;
  }

  setSendFunction(fn) {
    this.sendWhatsAppMessageFn = fn;
  }

  async sendReply(tenantId, phone, text) {
    // Log outbound message to database
    try {
      db.prepare(`
        INSERT INTO messages (tenant_id, customer_phone, from_me, text)
        VALUES (?, ?, 1, ?)
      `).run(tenantId, phone, text);
    } catch (e) {
      console.error('Error logging outbound message:', e);
    }

    if (this.sendWhatsAppMessageFn) {
      return await this.sendWhatsAppMessageFn(tenantId, phone, text);
    }
    return false;
  }

  getConversation(tenantId, phone) {
    let conv = db.prepare('SELECT * FROM conversations WHERE tenant_id = ? AND customer_phone = ?').get(tenantId, phone);
    if (!conv) {
      db.prepare(`
        INSERT INTO conversations (tenant_id, customer_phone, state, context_data, is_human_agent)
        VALUES (?, ?, 'idle', '{}', 0)
      `).run(tenantId, phone);
      conv = db.prepare('SELECT * FROM conversations WHERE tenant_id = ? AND customer_phone = ?').get(tenantId, phone);
    }
    return {
      ...conv,
      context: JSON.parse(conv.context_data || '{}')
    };
  }

  updateConversation(tenantId, phone, state, context, isHuman = null) {
    const isHumanVal = isHuman !== null ? isHuman : db.prepare('SELECT is_human_agent FROM conversations WHERE tenant_id = ? AND customer_phone = ?').get(tenantId, phone)?.is_human_agent || 0;
    db.prepare(`
      UPDATE conversations
      SET state = ?, context_data = ?, is_human_agent = ?, last_message_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND customer_phone = ?
    `).run(state, JSON.stringify(context), isHumanVal, tenantId, phone);
  }

  async handleIncomingMessage({ tenantId, customerPhone, text, pushName = '' }) {
    const rawText = (text || '').trim();
    const lowerText = rawText.toLowerCase();

    // Log message
    db.prepare(`
      INSERT INTO messages (tenant_id, customer_phone, from_me, text)
      VALUES (?, ?, 0, ?)
    `).run(tenantId, customerPhone, rawText);

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    if (!tenant) return;

    const conv = this.getConversation(tenantId, customerPhone);

    // Update customer name if provided
    if (pushName && (!conv.customer_name || conv.customer_name === 'Cliente')) {
      db.prepare('UPDATE conversations SET customer_name = ? WHERE id = ?').run(pushName, conv.id);
    }

    const customerName = pushName || conv.customer_name || 'Cliente';

    // Check if attendant has taken over human support
    if (conv.is_human_agent === 1) {
      if (lowerText === '#bot' || lowerText === '#reiniciar' || lowerText === '#menu') {
        this.updateConversation(tenantId, customerPhone, 'idle', {}, 0);
        await this.sendReply(tenantId, customerPhone, `🤖 Atendimento automático reativado!\n\n${tenant.welcome_message.replace('{nome}', tenant.name)}`);
        return;
      }
      // Attendant is chatting manually; bot doesn't interfere
      return;
    }

    // Command to ask for human assistance
    if (lowerText === 'humano' || lowerText === 'atendente' || lowerText === 'farmaceutico' || lowerText === 'farmacêutico') {
      this.updateConversation(tenantId, customerPhone, 'human_support', conv.context, 1);
      await this.sendReply(
        tenantId,
        customerPhone,
        `👨‍⚕️ Transferindo seu atendimento para a nossa equipe e farmacêutico(a) da *${tenant.name}*!\n\nAguarde um momento enquanto um membro da nossa equipe visualiza sua conversa no painel. (Caso queira voltar ao robô automático a qualquer momento, digite *#bot*).`
      );
      return;
    }

    // Reset command
    if (lowerText === 'inicio' || lowerText === 'início' || lowerText === 'menu' || lowerText === 'cancelar') {
      this.updateConversation(tenantId, customerPhone, 'idle', {});
      await this.sendReply(
        tenantId,
        customerPhone,
        `Olá, ${customerName}! 💊 Bem-vindo(a) à *${tenant.name}*.\n\nQual medicamento ou produto de saúde você procura hoje?`
      );
      return;
    }

    // State Machine
    switch (conv.state) {
      case 'idle':
      case 'searching': {
        const isGreeting = /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|e ai|e aí|opa)/i.test(lowerText);
        if (isGreeting && lowerText.split(' ').length <= 3) {
          this.updateConversation(tenantId, customerPhone, 'searching', {});
          const welcomeMsg = tenant.welcome_message
            ? tenant.welcome_message.replace('{nome}', tenant.name)
            : `Olá, ${customerName}! Bem-vindo(a) à *${tenant.name}*! 💊\nQual remédio você gostaria de consultar?`;
          await this.sendReply(tenantId, customerPhone, welcomeMsg);
          return;
        }

        // Perform search
        await this.searchAndRespondProducts(tenantId, customerPhone, rawText, conv.context);
        break;
      }

      case 'choosing_product': {
        const choiceNum = parseInt(lowerText, 10);
        const candidates = conv.context.candidates || [];

        if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > candidates.length) {
          // If user typed a new search word instead of a number
          if (rawText.length > 2 && isNaN(choiceNum)) {
            await this.searchAndRespondProducts(tenantId, customerPhone, rawText, conv.context);
            return;
          }
          await this.sendReply(
            tenantId,
            customerPhone,
            `Opção inválida. Por favor, digite o *número* de 1 a ${candidates.length} correspondente ao medicamento desejado, ou digite o nome de outro produto para nova busca:`
          );
          return;
        }

        const selected = candidates[choiceNum - 1];
        const availableStock = selected.stock_quantity - selected.reserved_quantity;

        const newContext = {
          ...conv.context,
          selected_product: selected
        };
        this.updateConversation(tenantId, customerPhone, 'choosing_qty', newContext);

        let msg = `Encontrei este produto:\n\n` +
          `💊 *${selected.name}*\n` +
          `🔬 Princípio Ativo: ${selected.active_ingredient || 'Não informado'}\n` +
          `Dosagem: *${selected.dosage || 'Padrão'}*\n` +
          `📦 Apresentação: ${selected.presentation || selected.form || 'Unidade'}\n` +
          `💰 Valor: *R$ ${Number(selected.sale_price).toFixed(2)}*\n` +
          `📊 Disponível para compra: *${availableStock} unidades*\n\n` +
          (selected.requires_prescription ? `⚠️ *Atenção:* Medicamento com retenção de receita (${selected.prescription_type}).\n\n` : '') +
          `Quantas unidades você deseja? (Digite a quantidade em número, ex: *1*, *2*):`;

        await this.sendReply(tenantId, customerPhone, msg);
        break;
      }

      case 'choosing_qty': {
        const qtyMatch = rawText.match(/\d+/);
        const qty = qtyMatch ? parseInt(qtyMatch[0], 10) : NaN;
        const selected = conv.context.selected_product;

        if (isNaN(qty) || qty <= 0) {
          await this.sendReply(tenantId, customerPhone, 'Por favor, informe a quantidade desejada em números (ex: *1*, *2*, *3*):');
          return;
        }

        const availableStock = selected.stock_quantity - selected.reserved_quantity;
        if (qty > availableStock) {
          await this.sendReply(
            tenantId,
            customerPhone,
            `Desculpe! No momento temos apenas *${availableStock}* unidade(s) disponível(is) de *${selected.name}* no estoque.\nQuantas você gostaria de levar?`
          );
          return;
        }

        const currentCart = conv.context.cart || [];
        const itemTotal = qty * selected.sale_price;

        currentCart.push({
          product_id: selected.id,
          name: selected.name,
          dosage: selected.dosage,
          presentation: selected.presentation,
          quantity: qty,
          unit_price: selected.sale_price,
          total_price: itemTotal,
          requires_prescription: selected.requires_prescription
        });

        const newContext = {
          ...conv.context,
          cart: currentCart,
          selected_product: null
        };

        this.updateConversation(tenantId, customerPhone, 'in_cart', newContext);
        await this.showCartMenu(tenantId, customerPhone, newContext);
        break;
      }

      case 'in_cart': {
        if (lowerText === '1' || lowerText.includes('adicionar') || lowerText.includes('mais')) {
          this.updateConversation(tenantId, customerPhone, 'searching', conv.context);
          await this.sendReply(tenantId, customerPhone, 'Qual outro medicamento ou produto você procura? (Digite o nome):');
          return;
        }

        if (lowerText === '3' || lowerText.includes('limpar')) {
          this.updateConversation(tenantId, customerPhone, 'idle', {});
          await this.sendReply(tenantId, customerPhone, '🗑️ Carrinho esvaziado com sucesso! Qual remédio você gostaria de consultar agora?');
          return;
        }

        if (lowerText === '2' || lowerText.includes('fechar') || lowerText.includes('finalizar')) {
          const cart = conv.context.cart || [];
          if (cart.length === 0) {
            this.updateConversation(tenantId, customerPhone, 'idle', {});
            await this.sendReply(tenantId, customerPhone, 'Seu carrinho está vazio. Qual produto você procura?');
            return;
          }

          // Check if any product requires prescription
          const hasPrescription = cart.some(i => i.requires_prescription);
          if (hasPrescription) {
            this.updateConversation(tenantId, customerPhone, 'prescription_check', conv.context);
            await this.sendReply(
              tenantId,
              customerPhone,
              `📋 *Validação de Receita Médica*\n\n` +
              `Um ou mais medicamentos do seu pedido exigem retenção ou conferência de receita médica.\n\n` +
              `📷 *Por favor, envie uma foto nítida da sua receita médica aqui no WhatsApp.*\n` +
              `Nosso farmacêutico fará a conferência antes da liberação do pedido.\n\n` +
              `Assim que enviar ou se já tiver a receita em mãos, digite *OK* para prosseguir.`
            );
            return;
          }

          // Proceed to delivery selection
          this.updateConversation(tenantId, customerPhone, 'choosing_delivery', conv.context);
          await this.sendReply(
            tenantId,
            customerPhone,
            `Como você prefere receber o seu pedido?\n\n` +
            `[1] 🛵 *Entrega no endereço (Delivery)*\n` +
            `[2] 🏪 *Retirar no balcão da farmácia*\n\n` +
            `Responda com *1* ou *2*:`
          );
          return;
        }

        await this.showCartMenu(tenantId, customerPhone, conv.context);
        break;
      }

      case 'prescription_check': {
        // Customer acknowledged prescription
        this.updateConversation(tenantId, customerPhone, 'choosing_delivery', conv.context);
        await this.sendReply(
          tenantId,
          customerPhone,
          `Receita registrada! ✅ Nossa equipe farmacêutica validará o documento na separação.\n\n` +
          `Como você prefere receber o seu pedido?\n\n` +
          `[1] 🛵 *Entrega no endereço (Delivery)*\n` +
          `[2] 🏪 *Retirar no balcão da farmácia*\n\n` +
          `Responda com *1* ou *2*:`
        );
        break;
      }

      case 'choosing_delivery': {
        if (lowerText === '1' || lowerText.includes('entrega') || lowerText.includes('delivery')) {
          this.updateConversation(tenantId, customerPhone, 'asking_address', {
            ...conv.context,
            delivery_type: 'delivery'
          });
          await this.sendReply(
            tenantId,
            customerPhone,
            `🛵 *Excelente! Entregamos no conforto da sua casa.*\n\nPor favor, digite seu *endereço completo de entrega*:\n(Rua, Número, Bairro e Complemento, ex: *Rua das Flores, 123, Centro - Apto 101*)`
          );
          return;
        }

        if (lowerText === '2' || lowerText.includes('retirar') || lowerText.includes('balcão') || lowerText.includes('balcao')) {
          await this.createOrderAndSendPix(tenantId, customerPhone, customerName, {
            ...conv.context,
            delivery_type: 'pickup',
            address: 'Retirada no Balcão da Farmácia',
            delivery_fee: 0.0
          });
          return;
        }

        await this.sendReply(tenantId, customerPhone, 'Por favor, responda com *1* para Entrega ou *2* para Retirada no balcão:');
        break;
      }

      case 'asking_address': {
        if (rawText.length < 5) {
          await this.sendReply(tenantId, customerPhone, 'Por favor, digite o endereço completo com rua, número e bairro para que o entregador localize com facilidade:');
          return;
        }

        const cart = conv.context.cart || [];
        const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
        let deliveryFee = tenant.delivery_fee_default || 7.00;

        if (tenant.free_shipping_threshold && subtotal >= tenant.free_shipping_threshold) {
          deliveryFee = 0.00;
        }

        await this.createOrderAndSendPix(tenantId, customerPhone, customerName, {
          ...conv.context,
          delivery_type: 'delivery',
          address: rawText,
          delivery_fee: deliveryFee
        });
        break;
      }

      case 'awaiting_payment': {
        // Customer says "já paguei" or sends proof
        // STRICT RULE: "O entregador só será acionado depois da confirmação real do pagamento e da liberação do pedido pela farmácia. Foto de comprovante ou mensagem dizendo 'já paguei' não poderá liberar a entrega."
        await this.sendReply(
          tenantId,
          customerPhone,
          `Recebemos sua mensagem! ⏳\n\n` +
          `Nossa equipe financeira e o sistema bancário estão conferindo a confirmação do pagamento em nossa conta.\n\n` +
          `🔒 *Segurança:* Por normas da farmácia, a liberação e o envio do motoboy ocorrem logo após a conciliação bancária do Pix e a conferência farmacêutica dos itens.\n\n` +
          `Assim que confirmarmos, você receberá a notificação instantânea aqui no WhatsApp!`
        );
        break;
      }

      default: {
        this.updateConversation(tenantId, customerPhone, 'idle', {});
        await this.sendReply(tenantId, customerPhone, tenant.welcome_message.replace('{nome}', tenant.name));
      }
    }
  }

  async searchAndRespondProducts(tenantId, customerPhone, queryText, context) {
    const searchParam = `%${queryText}%`;
    const products = db.prepare(`
      SELECT * FROM products
      WHERE tenant_id = ? AND active = 1 AND (
        name LIKE ? OR active_ingredient LIKE ? OR barcode LIKE ?
      )
      LIMIT 10
    `).all(tenantId, searchParam, searchParam, searchParam);

    if (products.length === 0) {
      await this.sendReply(
        tenantId,
        customerPhone,
        `Não encontrei nenhum produto para "*${queryText}*" no momento. 😕\n\n` +
        `Tente buscar por outro termo ou pelo princípio ativo (ex: *Dipirona*, *Paracetamol*, *Ibuprofeno*).\n` +
        `Se preferir, digite *HUMANO* para falar diretamente com o farmacêutico.`
      );
      return;
    }

    if (products.length === 1) {
      const p = products[0];
      const availableStock = p.stock_quantity - p.reserved_quantity;

      const newContext = {
        ...context,
        selected_product: p
      };
      this.updateConversation(tenantId, customerPhone, 'choosing_qty', newContext);

      let msg = `Encontrei este produto no nosso estoque:\n\n` +
        `💊 *${p.name}*\n` +
        `🔬 Princípio Ativo: ${p.active_ingredient || 'Não informado'}\n` +
        `Dosagem: *${p.dosage || 'Padrão'}*\n` +
        `📦 Apresentação: ${p.presentation || p.form || 'Unidade'}\n` +
        `💰 Valor: *R$ ${Number(p.sale_price).toFixed(2)}*\n` +
        `📊 Disponível para compra: *${availableStock} unidades*\n\n` +
        (p.requires_prescription ? `⚠️ *Atenção:* Medicamento sob retenção de receita médica.\n\n` : '') +
        `Quantas unidades você deseja? (Digite a quantidade em número, ex: *1*, *2*):`;

      await this.sendReply(tenantId, customerPhone, msg);
      return;
    }

    // Multiple products found
    const newContext = {
      ...context,
      candidates: products
    };
    this.updateConversation(tenantId, customerPhone, 'choosing_product', newContext);

    let listMsg = `Encontrei ${products.length} opções para "*${queryText}*".\n` +
      `Por favor, responda com o *número* da opção desejada:\n\n`;

    products.forEach((p, idx) => {
      const available = p.stock_quantity - p.reserved_quantity;
      listMsg += `*[${idx + 1}]* ${p.name} - ${p.dosage || ''} (${p.presentation || p.form || ''})\n` +
        `   ↳ Preço: *R$ ${Number(p.sale_price).toFixed(2)}* | Disp: ${available} un.\n\n`;
    });

    listMsg += `Digite o número de 1 a ${products.length}:`;
    await this.sendReply(tenantId, customerPhone, listMsg);
  }

  async showCartMenu(tenantId, customerPhone, context) {
    const cart = context.cart || [];
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);

    let msg = `🛒 *SEU CARRINHO DE COMPRAS:*\n\n`;
    cart.forEach((item, idx) => {
      msg += `• ${item.quantity}x *${item.name}* (${item.dosage || ''})\n` +
        `  Valor: R$ ${item.total_price.toFixed(2)} (R$ ${item.unit_price.toFixed(2)} un.)\n`;
    });

    msg += `\n💰 *Subtotal: R$ ${subtotal.toFixed(2)}*\n\n` +
      `O que você deseja fazer agora?\n` +
      `*[1]* ➕ Adicionar outro remédio/produto\n` +
      `*[2]* 🚀 Finalizar Pedido e Pagar via Pix\n` +
      `*[3]* 🗑️ Limpar carrinho e cancelar\n\n` +
      `Digite *1*, *2* ou *3*:`;

    await this.sendReply(tenantId, customerPhone, msg);
  }

  async createOrderAndSendPix(tenantId, customerPhone, customerName, context) {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    const cart = context.cart || [];
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    const deliveryFee = context.delivery_fee || 0.0;
    const total = subtotal + deliveryFee;

    // Reserve inventory
    const updateReserved = db.prepare(`
      UPDATE products SET reserved_quantity = reserved_quantity + ? WHERE id = ?
    `);
    for (const item of cart) {
      updateReserved.run(item.quantity, item.product_id);
    }

    // Insert order
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        tenant_id, customer_phone, customer_name, delivery_type, delivery_address, delivery_fee,
        subtotal, total, status, payment_method, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'PIX', ?)
    `);

    const orderRes = insertOrder.run(
      tenantId,
      customerPhone,
      customerName,
      context.delivery_type || 'delivery',
      context.address || 'Retirada na Farmácia',
      deliveryFee,
      subtotal,
      total,
      context.delivery_type === 'pickup' ? 'Retirada no balcão da farmácia' : ''
    );

    const orderId = orderRes.lastInsertRowid;

    // Insert order items
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, dosage, presentation, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of cart) {
      insertItem.run(
        orderId,
        item.product_id,
        item.name,
        item.dosage || '',
        item.presentation || '',
        item.quantity,
        item.unit_price,
        item.total_price
      );
    }

    // Generate PIX
    const pixCode = generatePixCode({
      pixKey: tenant.pix_key || '12345678000190',
      pixType: tenant.pix_type || 'cnpj',
      merchantName: tenant.name,
      merchantCity: 'SAO PAULO',
      amount: total,
      txid: `ZP${orderId}`
    });

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;

    db.prepare('UPDATE orders SET pix_code = ?, pix_qrcode_url = ? WHERE id = ?').run(pixCode, qrCodeUrl, orderId);

    // Update conversation state to awaiting_payment
    this.updateConversation(tenantId, customerPhone, 'awaiting_payment', {
      ...context,
      active_order_id: orderId
    });

    // Format WhatsApp confirmation message
    let orderMsg = `📋 *PEDIDO #${orderId} GERADO COM SUCESSO!*\n` +
      `-----------------------------------------\n` +
      `🏪 *Farmácia:* ${tenant.name}\n` +
      `👤 *Cliente:* ${customerName}\n` +
      `📍 *${context.delivery_type === 'delivery' ? 'Entrega em' : 'Modo'}:* ${context.address}\n\n` +
      `📦 *ITENS DO PEDIDO:*\n`;

    cart.forEach(item => {
      orderMsg += `• ${item.quantity}x ${item.name} (${item.dosage || ''}) - R$ ${item.total_price.toFixed(2)}\n`;
    });

    orderMsg += `\nSubtotal: R$ ${subtotal.toFixed(2)}\n` +
      `Taxa de Entrega: R$ ${deliveryFee.toFixed(2)}\n` +
      `*VALOR TOTAL: R$ ${total.toFixed(2)}*\n\n` +
      `💠 *PAGAMENTO VIA PIX (Copia e Cola):*\n` +
      `Copie o código abaixo e cole no seu aplicativo do banco:\n\n` +
      `\`${pixCode}\`\n\n` +
      `⏱️ *O que acontece agora?*\n` +
      `1. Assim que seu banco confirmar a transferência Pix e nossa equipe conferir no sistema, seu pedido entrará em separação.\n` +
      `2. ${context.delivery_type === 'delivery' ? 'Nosso sistema acionará automaticamente o motoboy para levar até seu endereço!' : 'Avisaremos para você vir retirar no balcão!'}\n\n` +
      `Obrigado por escolher a ${tenant.name}! 💚`;

    await this.sendReply(tenantId, customerPhone, orderMsg);
  }

  // --- ACTIONS EXECUTED FROM THE PHARMACY DASHBOARD ---

  async confirmOrderPayment(orderId, confirmedByUser = 'Farmacêutico') {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Pedido não encontrado.');
    if (order.status !== 'pending_payment') {
      return order;
    }

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(order.tenant_id);

    // Deduct physical inventory & clear reservation
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const updateStock = db.prepare(`
      UPDATE products
      SET stock_quantity = MAX(0, stock_quantity - ?),
          reserved_quantity = MAX(0, reserved_quantity - ?)
      WHERE id = ?
    `);

    for (const item of items) {
      updateStock.run(item.quantity, item.quantity, item.product_id);
    }

    db.prepare(`
      UPDATE orders
      SET status = 'paid',
          payment_confirmed_at = CURRENT_TIMESTAMP,
          confirmed_by_user = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(confirmedByUser, orderId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (tenant_id, user_name, action, details)
      VALUES (?, ?, 'PAGAMENTO_CONFIRMADO', ?)
    `).run(order.tenant_id, confirmedByUser, `Pagamento do Pedido #${orderId} de R$ ${order.total.toFixed(2)} confirmado.`);

    // Send WhatsApp notification to customer
    await this.sendReply(
      order.tenant_id,
      order.customer_phone,
      `✅ *PAGAMENTO CONFIRMADO!* 🎉\n\n` +
      `Olá, seu pagamento referente ao *Pedido #${order.id}* (R$ ${order.total.toFixed(2)}) foi confirmado com sucesso!\n\n` +
      `Nossa equipe da *${tenant.name}* já está separando e embalando seus medicamentos com todo o cuidado.\n` +
      `Em breve avisaremos assim que sair para entrega!`
    );

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  }

  async releaseOrderForDelivery(orderId, specifiedDriverId = null) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Pedido não encontrado.');

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(order.tenant_id);

    if (order.delivery_type === 'pickup') {
      db.prepare(`
        UPDATE orders SET status = 'ready_for_delivery', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(orderId);

      await this.sendReply(
        order.tenant_id,
        order.customer_phone,
        `📦 *SEU PEDIDO ESTÁ PRONTO PARA RETIRADA!*\n\n` +
        `Olá! Seu pedido *#${order.id}* já foi separado e está aguardando você no balcão da *${tenant.name}* (${tenant.address}).\n` +
        `Horário de atendimento: ${tenant.business_hours}. Até logo!`
      );

      return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    }

    // Delivery mode: Select driver
    let driver = null;
    if (specifiedDriverId) {
      driver = db.prepare('SELECT * FROM delivery_drivers WHERE id = ? AND tenant_id = ?').get(specifiedDriverId, order.tenant_id);
    } else {
      // Find first available driver
      driver = db.prepare(`
        SELECT * FROM delivery_drivers
        WHERE tenant_id = ? AND status = 'available' AND active = 1
        ORDER BY id ASC LIMIT 1
      `).get(order.tenant_id);
    }

    if (!driver) {
      // If no driver currently available, mark ready_for_delivery and alert
      db.prepare(`
        UPDATE orders SET status = 'ready_for_delivery', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(orderId);
      return { order: db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId), warning: 'Nenhum entregador disponível no momento. Pedido marcado como Pronto para Entrega.' };
    }

    // Assign driver and mark in transit
    db.prepare(`
      UPDATE orders
      SET status = 'in_transit',
          driver_id = ?,
          driver_notified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(driver.id, orderId);

    db.prepare(`UPDATE delivery_drivers SET status = 'on_delivery' WHERE id = ?`).run(driver.id);

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const itemsList = items.map(i => `• ${i.quantity}x ${i.product_name} (${i.dosage || ''})`).join('\n');

    // CRITICAL REQUIREMENT: Notify the Motoboy via WhatsApp!
    const motoboyMsg = `🚨 *NOVA ENTREGA DISPONÍVEL!* 🛵📦\n\n` +
      `*Pedido:* #${order.id}\n` +
      `*Farmácia:* ${tenant.name}\n` +
      `*Cliente:* ${order.customer_name || 'Cliente'} (${order.customer_phone})\n` +
      `*Endereço de Entrega:*\n📍 ${order.delivery_address}\n\n` +
      `*Itens do Pacote:*\n${itemsList}\n\n` +
      `*Status Financeiro:* ✅ PAGO VIA PIX (R$ ${order.total.toFixed(2)})\n` +
      `*Sua Taxa de Entrega:* R$ ${order.delivery_fee.toFixed(2)}\n` +
      (order.notes ? `*Observações:* ${order.notes}\n` : '') +
      `\n👉 Por favor, retire o pacote na bancada da farmácia e leve com cuidado ao cliente!`;

    await this.sendReply(order.tenant_id, driver.phone, motoboyMsg);

    // Notify customer
    await this.sendReply(
      order.tenant_id,
      order.customer_phone,
      `🛵💨 *SEU PEDIDO SAIU PARA ENTREGA!*\n\n` +
      `O entregador *${driver.name}* (${driver.vehicle || 'Moto'} placa: ${driver.plate || '---'}) já retirou seus medicamentos e está a caminho do seu endereço!\n` +
      `Endereço de entrega: ${order.delivery_address}\n\n` +
      `Fique atento ao interfone ou telefone. Logo ele chegará!`
    );

    return { order: db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId), driver };
  }

  async markOrderDelivered(orderId) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Pedido não encontrado.');

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(order.tenant_id);

    db.prepare(`
      UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(orderId);

    // Free up driver
    if (order.driver_id) {
      db.prepare(`UPDATE delivery_drivers SET status = 'available' WHERE id = ?`).run(order.driver_id);
    }

    // Final customer message
    await this.sendReply(
      order.tenant_id,
      order.customer_phone,
      `🎉 *PEDIDO ENTREGUE COM SUCESSO!*\n\n` +
      `Seu pedido *#${order.id}* foi finalizado. Esperamos que tenha tido uma ótima experiência com a *${tenant.name}*!\n\n` +
      `💚 Cuide bem da sua saúde. Qualquer dúvida ou nova necessidade, estamos sempre por aqui no WhatsApp!`
    );

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  }
}

module.exports = new BotEngine();
