const db = require('../db/database');
const qrcode = require('qrcode');

// Helper to clean and format Pix Keys according to Banco Central do Brasil rules
function formatPixKey(rawKey, pixType) {
  if (!rawKey) return '12345678000190';
  const trimmed = String(rawKey).trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (pixType === 'cpf' || (!pixType && digitsOnly.length === 11 && !trimmed.includes('@'))) {
    return digitsOnly;
  }
  if (pixType === 'cnpj' || (!pixType && digitsOnly.length === 14 && !trimmed.includes('@'))) {
    return digitsOnly;
  }
  if (pixType === 'phone' || (!pixType && (trimmed.startsWith('+') || (digitsOnly.length >= 10 && digitsOnly.length <= 13 && !trimmed.includes('@'))))) {
    let phoneDigits = digitsOnly;
    if (phoneDigits.startsWith('55') && phoneDigits.length > 11) {
      phoneDigits = phoneDigits.substring(2);
    }
    return '+55' + phoneDigits;
  }
  if (pixType === 'email' || trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  return trimmed.toLowerCase();
}

// Helper to generate Brazilian PIX Copia e Cola (standard EMV BR Code)
function generatePixCode({ pixKey, pixType, merchantName, merchantCity, amount, txid }) {
  const cleanKey = formatPixKey(pixKey, pixType);
  const cleanName = (merchantName || 'FARMACIA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .substring(0, 25)
    .toUpperCase();
  const cleanCity = (merchantCity || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .substring(0, 15)
    .toUpperCase();
  const formattedAmount = Number(amount || 0).toFixed(2);
  const cleanTxid = (txid || '***')
    .replace(/[^A-Za-z0-9]/g, '')
    .substring(0, 25) || '***';

  function formatField(id, value) {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  }

  // 00: Payload Format Indicator (01)
  const formatInd = formatField('00', '01');
  // 01: Point of Initiation Method (12 = Static / multi-use with fixed amount)
  const initMethod = formatField('01', '12');

  // 26: Merchant Account Information
  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', cleanKey);
  const accountInfo = formatField('26', `${gui}${keyField}`);

  // 52: Merchant Category Code (0000 = ISO 18245 general merchant)
  const catCode = formatField('52', '0000');
  // 53: Transaction Currency (986 = Real brasileiro)
  const currency = formatField('53', '986');
  // 54: Transaction Amount
  const amountField = formatField('54', formattedAmount);
  // 58: Country Code (BR)
  const country = formatField('58', 'BR');
  // 59: Merchant Name
  const nameField = formatField('59', cleanName || 'FARMACIA');
  // 60: Merchant City
  const cityField = formatField('60', cleanCity || 'SAO PAULO');
  // 62: Additional Data Field Template (TxID)
  const txidSubfield = formatField('05', cleanTxid);
  const additionalData = formatField('62', txidSubfield);

  let payload = `${formatInd}${initMethod}${accountInfo}${catCode}${currency}${amountField}${country}${nameField}${cityField}${additionalData}6304`;

  // CRC-16/CCITT-FALSE calculation
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
    this.broadcastFn = null;
  }

  setSendFunction(fn) {
    this.sendWhatsAppMessageFn = fn;
  }

  setBroadcastFunction(fn) {
    this.broadcastFn = fn;
  }

  broadcast(tenantId, type, payload) {
    if (this.broadcastFn) {
      try {
        this.broadcastFn(tenantId, type, payload);
      } catch (e) {
        console.error('Error in botEngine broadcast:', e);
      }
    }
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

    // Command to ask for human assistance (supports 0, 'atendente', 'falar com atendente', etc.)
    const isHumanRequest =
      lowerText === '0' ||
      lowerText === 'humano' ||
      lowerText === 'atendente' ||
      lowerText === 'farmaceutico' ||
      lowerText === 'farmacêutico' ||
      lowerText === 'suporte' ||
      lowerText === 'ajuda' ||
      lowerText.includes('falar com atendente') ||
      lowerText.includes('falar com humano') ||
      lowerText.includes('falar com alguem') ||
      lowerText.includes('falar com alguém') ||
      lowerText.includes('falar com farmac') ||
      lowerText.includes('quero atendente') ||
      lowerText.includes('chamar atendente') ||
      lowerText.includes('preciso de atendente') ||
      lowerText.includes('passar para atendente') ||
      lowerText.includes('falar com pessoa') ||
      /^(quero |preciso )?(falar com |chamar )?(atendente|humano|farmac[eê]utico|balc[aã]o)/i.test(lowerText);

    if (isHumanRequest) {
      this.updateConversation(tenantId, customerPhone, 'human_support', conv.context, 1);
      this.broadcast(tenantId, 'human_support_requested', {
        customerPhone,
        customerName,
        text: rawText,
        timestamp: new Date().toISOString(),
      });
      await this.sendReply(
        tenantId,
        customerPhone,
        `👨‍⚕️ *ATENDIMENTO HUMANIZADO ACIONADO!*\n\nOlá, ${customerName}! Transferi sua conversa diretamente para nossa equipe e farmacêutico(a) no balcão da *${tenant.name}*.\n\nUm de nossos atendentes já recebeu o aviso no painel e responderá você aqui em instantes!\n\n_(Caso queira voltar ao robô automático a qualquer momento, digite *#bot* ou *MENU*)_`
      );
      return;
    }

    // Command to opt-out from promotional campaigns (Anti-ban safety!)
    if (
      lowerText === 'parar' ||
      lowerText === 'sair' ||
      lowerText === 'descadastrar' ||
      lowerText === 'cancelar promo' ||
      lowerText === 'cancelar ofertas' ||
      lowerText === 'nao quero mais' ||
      lowerText === 'não quero mais'
    ) {
      try {
        db.prepare(`
          INSERT OR REPLACE INTO opt_out_leads (tenant_id, phone, reason)
          VALUES (?, ?, 'PARAR')
        `).run(tenantId, customerPhone);
      } catch (err) {
        console.error('Erro ao registrar opt-out:', err);
      }

      await this.sendReply(
        tenantId,
        customerPhone,
        `✅ *Descadastro Realizado com Sucesso!*\n\nVocê não receberá mais notificações ou promoções da *${tenant.name}*.\n\nSempre que precisar de remédios ou quiser falar conosco, basta enviar qualquer mensagem normal aqui!`
      );
      return;
    }

    // Reset command
    if (lowerText === 'inicio' || lowerText === 'início' || lowerText === 'menu' || lowerText === 'cancelar') {
      this.updateConversation(tenantId, customerPhone, 'idle', {});
      await this.sendReply(
        tenantId,
        customerPhone,
        `Olá, ${customerName}! 💊 Bem-vindo(a) à *${tenant.name}*.\n\n` +
        `Qual medicamento ou produto de saúde você procura hoje?\n` +
        `_(Digite o nome do remédio ou digite *0* para falar com o atendente)_`
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
          const baseWelcome = tenant.welcome_message
            ? tenant.welcome_message.replace('{nome}', tenant.name)
            : `Olá, ${customerName}! Bem-vindo(a) à *${tenant.name}*! 💊`;
          
          const welcomeMsg = `${baseWelcome}\n\n` +
            `📌 *Como posso te ajudar hoje?*\n` +
            `• Digite o *nome do remédio ou produto* que procura (ex: *Dipirona*, *Dorflex*)\n` +
            `• Ou digite *0* (ou *ATENDENTE*) para falar direto com nosso farmacêutico!`;

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
          const cart = conv.context.cart || [];
          const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
          const newContext = {
            ...conv.context,
            delivery_type: 'pickup',
            address: 'Retirada no Balcão da Farmácia',
            delivery_fee: 0.0,
            subtotal: subtotal,
            total: subtotal
          };
          this.updateConversation(tenantId, customerPhone, 'choosing_payment', newContext);

          await this.sendReply(
            tenantId,
            customerPhone,
            `🏪 *Retirada no Balcão Selecionada!*\n\n` +
            `📦 *Total dos produtos:* R$ ${subtotal.toFixed(2)}\n\n` +
            `Como você prefere realizar o pagamento?\n\n` +
            `*[1]* 💠 *Pix* (Gera código Copia e Cola / QR Code para pagar agora)\n` +
            `*[2]* 💳 *Cartão no Balcão* (Pagar na maquininha ao retirar)\n` +
            `*[3]* 💵 *Dinheiro no Balcão* (Pagar em espécie ao retirar)\n\n` +
            `Responda com *1*, *2* ou *3*:`
          );
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

        const total = subtotal + deliveryFee;
        const newContext = {
          ...conv.context,
          delivery_type: 'delivery',
          address: rawText,
          delivery_fee: deliveryFee,
          subtotal: subtotal,
          total: total
        };

        this.updateConversation(tenantId, customerPhone, 'choosing_payment', newContext);

        await this.sendReply(
          tenantId,
          customerPhone,
          `📍 *Endereço anotado com sucesso!*\n${rawText}\n\n` +
          `Subtotal: R$ ${subtotal.toFixed(2)}\n` +
          `Taxa de Entrega: R$ ${deliveryFee.toFixed(2)}\n` +
          `*VALOR TOTAL: R$ ${total.toFixed(2)}*\n\n` +
          `Qual será a forma de pagamento?\n\n` +
          `*[1]* 💠 *Pix* (Aprovação rápida via Copia e Cola)\n` +
          `*[2]* 💳 *Cartão na Entrega* (O motoboy leva a maquininha 🛵)\n` +
          `*[3]* 💵 *Dinheiro na Entrega* (Pagar ao entregador)\n\n` +
          `Responda com *1*, *2* ou *3*:`
        );
        break;
      }

      case 'choosing_payment': {
        const isPickup = conv.context.delivery_type === 'pickup';
        if (lowerText === '1' || lowerText.includes('pix')) {
          await this.createOrder(tenantId, customerPhone, customerName, {
            ...conv.context,
            payment_method: 'PIX'
          });
          return;
        }

        if (
          lowerText === '2' ||
          lowerText.includes('cartao') ||
          lowerText.includes('cartão') ||
          lowerText.includes('credito') ||
          lowerText.includes('crédito') ||
          lowerText.includes('debito') ||
          lowerText.includes('débito') ||
          lowerText.includes('maquininha')
        ) {
          const payMethod = isPickup ? 'CARD_PICKUP' : 'CARD_ON_DELIVERY';
          const note = isPickup
            ? 'Pagamento no balcão com Cartão'
            : 'Pagamento na entrega: Cartão (Entregador deve levar a maquininha)';
          await this.createOrder(tenantId, customerPhone, customerName, {
            ...conv.context,
            payment_method: payMethod,
            notes: note
          });
          return;
        }

        if (
          lowerText === '3' ||
          lowerText.includes('dinheiro') ||
          lowerText.includes('especie') ||
          lowerText.includes('espécie')
        ) {
          if (isPickup) {
            await this.createOrder(tenantId, customerPhone, customerName, {
              ...conv.context,
              payment_method: 'CASH_PICKUP',
              notes: 'Pagamento no balcão em Dinheiro'
            });
            return;
          } else {
            this.updateConversation(tenantId, customerPhone, 'asking_change', conv.context);
            await this.sendReply(
              tenantId,
              customerPhone,
              `💵 *Pagamento em Dinheiro selecionado!*\n\n` +
              `Você vai precisar de troco para quanto?\n` +
              `(Ex: *Troco para 50*, *Troco para 100*, ou digite *Não* se tiver o valor exato trocado):`
            );
            return;
          }
        }

        await this.sendReply(
          tenantId,
          customerPhone,
          `Por favor, escolha uma opção válida de pagamento:\n\n` +
          `*[1]* 💠 Pix\n` +
          `*[2]* 💳 Cartão ${isPickup ? 'no Balcão' : 'na Entrega (Levar maquininha)'}\n` +
          `*[3]* 💵 Dinheiro ${isPickup ? 'no Balcão' : 'na Entrega'}\n\n` +
          `Digite *1*, *2* ou *3*:`
        );
        break;
      }

      case 'asking_change': {
        let changeNote = '';
        if (/^(nao|não|naum|sem troco|trocado|exato|0|nao precisa|não precisa)$/i.test(lowerText.trim())) {
          changeNote = 'Dinheiro exato (não necessita de troco)';
        } else {
          changeNote = `Troco solicitado pelo cliente: ${rawText.trim()}`;
        }
        await this.createOrder(tenantId, customerPhone, customerName, {
          ...conv.context,
          payment_method: 'CASH_ON_DELIVERY',
          notes: changeNote
        });
        break;
      }

      case 'order_confirmed': {
        const orderId = conv.context.active_order_id;
        const lower = lowerText;
        if (
          lower.includes('status') ||
          lower.includes('pedido') ||
          lower.includes('onde esta') ||
          lower.includes('onde está') ||
          lower.includes('demora') ||
          lower.includes('previsao') ||
          lower.includes('previsão')
        ) {
          if (orderId) {
            const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
            if (order) {
              const statusTranslations = {
                paid: 'está sendo separado e embalado na farmácia 📦',
                ready_for_delivery: 'já está pronto aguardando saída 🛵',
                in_transit: 'já saiu para entrega com o motoboy 🛵💨',
                delivered: 'consta como entregue! 🎉',
                cancelled: 'foi cancelado.',
                pending_payment: 'está aguardando o pagamento do Pix ⏳'
              };
              await this.sendReply(
                tenantId,
                customerPhone,
                `Olá! O seu Pedido *#${orderId}* ${statusTranslations[order.status] || order.status}.\n\nSe precisar de ajuda adicional, digite *0* para falar com o atendente!`
              );
              return;
            }
          }
        }

        // If they ask for another product or greeting, reset to searching / idle
        this.updateConversation(tenantId, customerPhone, 'idle', {});
        await this.searchAndRespondProducts(tenantId, customerPhone, rawText, {});
        break;
      }

      case 'awaiting_payment': {
        const orderId = conv.context.active_order_id;
        const wantsPixAgain = lowerText.includes('pix') ||
          lowerText.includes('codigo') ||
          lowerText.includes('código') ||
          lowerText.includes('copia') ||
          lowerText.includes('chave') ||
          lowerText.includes('pagar') ||
          lowerText.includes('reenvia') ||
          lowerText.includes('manda');

        if (wantsPixAgain && orderId) {
          const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
          if (order && order.pix_code) {
            await this.sendReply(tenantId, customerPhone, `Aqui está novamente o seu código Pix Copia e Cola do Pedido #${orderId} (Total: *R$ ${Number(order.total).toFixed(2)}*):`);
            await new Promise((r) => setTimeout(r, 400));
            await this.sendReply(tenantId, customerPhone, order.pix_code);
            await new Promise((r) => setTimeout(r, 400));
            await this.sendReply(tenantId, customerPhone, `📱 *Basta tocar/segurar na mensagem acima para copiar o código Pix e colar no aplicativo do seu banco!*\n\nAssim que conferirmos o recebimento, liberamos seu pedido. 💚`);
            return;
          }
        }

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
        `Tente buscar por outro termo ou pelo princípio ativo (ex: *Dipirona*, *Paracetamol*, *Ibuprofeno*).\n\n` +
        `👉 Ou digite *0* (ou *ATENDENTE*) para falar diretamente com nosso farmacêutico no balcão.`
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
        `Quantas unidades você deseja? (Digite a quantidade em número, ex: *1*, *2*)\n` +
        `_(Ou digite *0* para falar com o atendente)_`;

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

    listMsg += `Digite o número de 1 a ${products.length}, ou digite *0* para falar com atendente:`;
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
      `*[2]* 🚀 Finalizar Pedido (Pix, Cartão ou Dinheiro)\n` +
      `*[3]* 🗑️ Limpar carrinho e cancelar\n\n` +
      `Digite *1*, *2* ou *3*:`;

    await this.sendReply(tenantId, customerPhone, msg);
  }

  async createOrderAndSendPix(tenantId, customerPhone, customerName, context) {
    return this.createOrder(tenantId, customerPhone, customerName, { ...context, payment_method: 'PIX' });
  }

  async createOrder(tenantId, customerPhone, customerName, context) {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    const cart = context.cart || [];
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    const deliveryFee = context.delivery_fee || 0.0;
    const total = subtotal + deliveryFee;
    const paymentMethod = context.payment_method || 'PIX';
    const isPix = paymentMethod === 'PIX';
    const initialStatus = isPix ? 'pending_payment' : 'paid';

    // If PIX, reserve stock; if in-person (Card/Cash), directly deduct physical stock
    if (isPix) {
      const updateReserved = db.prepare(`
        UPDATE products SET reserved_quantity = reserved_quantity + ? WHERE id = ?
      `);
      for (const item of cart) {
        updateReserved.run(item.quantity, item.product_id);
      }
    } else {
      const updateStock = db.prepare(`
        UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?
      `);
      for (const item of cart) {
        updateStock.run(item.quantity, item.product_id);
      }
    }

    // Insert order
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        tenant_id, customer_phone, customer_name, delivery_type, delivery_address, delivery_fee,
        subtotal, total, status, payment_method, notes, payment_confirmed_at, confirmed_by_user
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      initialStatus,
      paymentMethod,
      context.notes || (context.delivery_type === 'pickup' ? 'Retirada no balcão da farmácia' : ''),
      isPix ? null : new Date().toISOString(),
      isPix ? null : 'Automático (Pagamento Presencial)'
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

    // Audit log if in-person
    if (!isPix) {
      try {
        db.prepare(`
          INSERT INTO audit_logs (tenant_id, user_name, action, details)
          VALUES (?, ?, 'PEDIDO_CRIADO', ?)
        `).run(tenantId, 'Robô WhatsApp', `Pedido #${orderId} criado com pagamento presencial (${paymentMethod}) no valor de R$ ${total.toFixed(2)}.`);
      } catch (e) {
        console.error('Audit log error:', e);
      }
    }

    // Broadcast new order to connected web dashboard
    this.broadcast(tenantId, 'new_order_placed', {
      orderId,
      customerPhone,
      customerName,
      total,
      deliveryType: context.delivery_type,
      paymentMethod,
      status: initialStatus,
      timestamp: new Date().toISOString(),
    });

    if (isPix) {
      // Generate PIX
      const pixCode = generatePixCode({
        pixKey: tenant.pix_key || '12345678000190',
        pixType: tenant.pix_type || 'cnpj',
        merchantName: tenant.name,
        merchantCity: 'SAO PAULO',
        amount: total,
        txid: `ZP${orderId}`
      });

      let qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;
      try {
        qrCodeUrl = await qrcode.toDataURL(pixCode, { margin: 1, width: 300 });
      } catch (e) {
        console.error('Error generating QR code data URL:', e);
      }

      db.prepare('UPDATE orders SET pix_code = ?, pix_qrcode_url = ? WHERE id = ?').run(pixCode, qrCodeUrl, orderId);

      // Update conversation state to awaiting_payment
      this.updateConversation(tenantId, customerPhone, 'awaiting_payment', {
        ...context,
        active_order_id: orderId
      });

      // 1. Mensagem de Resumo do Pedido
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
        `💠 *PAGAMENTO VIA PIX:*\n` +
        `O código Pix Copia e Cola foi gerado e está sendo enviado na mensagem abaixo para você copiar facilmente. 👇`;

      await this.sendReply(tenantId, customerPhone, orderMsg);

      await new Promise((r) => setTimeout(r, 400));
      await this.sendReply(tenantId, customerPhone, pixCode);
      await new Promise((r) => setTimeout(r, 400));

      let instructionsMsg = `👆 *CÓDIGO PIX COPIA E COLA ENVIADO ACIMA!*\n\n` +
        `📱 *Como pagar no seu banco:*\n` +
        `1. Toque e segure a mensagem acima para *COPIAR* o código Pix.\n` +
        `2. Abra o aplicativo do seu banco (Nubank, Inter, Caixa, Itaú, BB, etc.).\n` +
        `3. Escolha a opção *Pix > Copia e Cola*.\n` +
        `4. Cole o código e confirme o valor de *R$ ${total.toFixed(2)}*.\n\n` +
        `⏱️ *Liberação do Pedido:*\n` +
        `Assim que o banco confirmar a transferência e nossa equipe conferir no sistema, seu pedido entrará em separação e ` +
        (context.delivery_type === 'delivery' ? 'o motoboy será acionado para a entrega! 🛵' : 'avisaremos para você retirar no balcão! 🏪') +
        `\n\nMuito obrigado pela confiança! 💚`;

      await this.sendReply(tenantId, customerPhone, instructionsMsg);
    } else {
      // In-person payment (Card or Cash)
      this.updateConversation(tenantId, customerPhone, 'order_confirmed', {
        ...context,
        active_order_id: orderId
      });

      let paymentLabel = '';
      if (paymentMethod === 'CARD_ON_DELIVERY') {
        paymentLabel = `💳 *Forma de Pagamento:* Cartão na Entrega (O entregador levará a maquininha 🛵)`;
      } else if (paymentMethod === 'CASH_ON_DELIVERY') {
        paymentLabel = `💵 *Forma de Pagamento:* Dinheiro na Entrega (${context.notes || 'Pagar ao entregador'})`;
      } else if (paymentMethod === 'CARD_PICKUP') {
        paymentLabel = `💳 *Forma de Pagamento:* Cartão no Balcão ao retirar`;
      } else {
        paymentLabel = `💵 *Forma de Pagamento:* Dinheiro no Balcão ao retirar`;
      }

      let orderMsg = `📋 *PEDIDO #${orderId} CONFIRMADO COM SUCESSO!* 🎉\n` +
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
        `*VALOR TOTAL A PAGAR: R$ ${total.toFixed(2)}*\n\n` +
        `${paymentLabel}\n\n` +
        `✅ *Seu pedido já foi encaminhado para separação imediata!*\n` +
        (context.delivery_type === 'delivery'
          ? `🛵 Assim que o pacote for retirado pelo motoboy, você receberá a notificação aqui com os dados do entregador!`
          : `🏪 Assim que estiver separado e embalado, te avisaremos para retirar no balcão!`);

      await this.sendReply(tenantId, customerPhone, orderMsg);
    }
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

    // CRITICAL REQUIREMENT: Clear financial instructions for Motoboy (Card machine vs Cash vs Pre-paid Pix)
    let paymentInstruction = '';
    if (order.payment_method === 'CARD_ON_DELIVERY') {
      paymentInstruction = `💳 *FINANCEIRO / COBRANÇA:*\n` +
        `🚨 *ATENÇÃO: LEVAR MAQUININHA DE CARTÃO!* 💳\n` +
        `*COBRAR DO CLIENTE NA ENTREGA:* R$ ${order.total.toFixed(2)}`;
    } else if (order.payment_method === 'CASH_ON_DELIVERY') {
      paymentInstruction = `💵 *FINANCEIRO / COBRANÇA:*\n` +
        `*RECEBER EM DINHEIRO DO CLIENTE:* R$ ${order.total.toFixed(2)}\n` +
        (order.notes ? `*OBS / TROCO:* ${order.notes}\n` : '');
    } else {
      paymentInstruction = `✅ *STATUS FINANCEIRO:* PAGO VIA PIX (R$ ${order.total.toFixed(2)})\n` +
        `*(NÃO COBRAR NADA DO CLIENTE - JÁ FOI PAGO)*`;
    }

    const motoboyMsg = `🚨 *NOVA ENTREGA DISPONÍVEL!* 🛵📦\n\n` +
      `*Pedido:* #${order.id}\n` +
      `*Farmácia:* ${tenant.name}\n` +
      `*Cliente:* ${order.customer_name || 'Cliente'} (${order.customer_phone})\n` +
      `*Endereço de Entrega:*\n📍 ${order.delivery_address}\n\n` +
      `*Itens do Pacote:*\n${itemsList}\n\n` +
      `${paymentInstruction}\n` +
      `*Sua Taxa de Entrega:* R$ ${order.delivery_fee.toFixed(2)}\n` +
      (order.notes && order.payment_method !== 'CASH_ON_DELIVERY' ? `*Observações:* ${order.notes}\n` : '') +
      `\n👉 Por favor, retire o pacote na bancada da farmácia e leve com cuidado ao cliente!`;

    await this.sendReply(order.tenant_id, driver.phone, motoboyMsg);

    // Customer payment reminder if in-person
    let customerPaymentReminder = '';
    if (order.payment_method === 'CARD_ON_DELIVERY') {
      customerPaymentReminder = `\n💳 *Pagamento:* Tenha seu cartão em mãos para passar na maquininha com o entregador (Total: R$ ${order.total.toFixed(2)}).`;
    } else if (order.payment_method === 'CASH_ON_DELIVERY') {
      customerPaymentReminder = `\n💵 *Pagamento:* Tenha o valor em dinheiro em mãos para pagar ao entregador (Total: R$ ${order.total.toFixed(2)}${order.notes ? ` - ${order.notes}` : ''}).`;
    }

    // Notify customer
    await this.sendReply(
      order.tenant_id,
      order.customer_phone,
      `🛵💨 *SEU PEDIDO SAIU PARA ENTREGA!*\n\n` +
      `O entregador *${driver.name}* (${driver.vehicle || 'Moto'} placa: ${driver.plate || '---'}) já retirou seus medicamentos e está a caminho do seu endereço!\n` +
      `Endereço de entrega: ${order.delivery_address}\n` +
      customerPaymentReminder +
      `\n\nFique atento ao interfone ou telefone. Logo ele chegará!`
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

const botEngineInstance = new BotEngine();
botEngineInstance.generatePixCode = generatePixCode;
botEngineInstance.formatPixKey = formatPixKey;

module.exports = botEngineInstance;
