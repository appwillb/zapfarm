const db = require('../db/database');

/**
 * Normaliza e limpa o texto do cliente, removendo pontuações e palavras vazias (stop-words)
 * comuns em perguntas de balcão de farmácia (ex: "qual o valor do", "quanto custa", "tem").
 */
function parseProductQueries(text) {
  if (!text || typeof text !== 'string') return [];

  // Remove URLs ou marcações
  let cleaned = text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[?!.,;:\\/()"'`~_—*#]/g, ' ')
    .toLowerCase();

  const stopwords = [
    'qual', 'quais', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das',
    'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'em', 'pra', 'para',
    'valor', 'valores', 'preco', 'preço', 'precos', 'preços', 'quanto', 'quantos',
    'custa', 'custam', 'sai', 'saem', 'ta', 'tá', 'fica', 'ficam',
    'tem', 'têm', 'temos', 'voces', 'vocês', 'vcs', 'vc', 'voce', 'você',
    'vende', 'vendem', 'gostaria', 'queria', 'saber', 'favor', 'por', 'sobre',
    'olá', 'ola', 'bom', 'dia', 'boa', 'tarde', 'noite', 'oi', 'opa', 'alo', 'alô',
    'porfavor', 'pfv', 'pf', 'preciso', 'procura', 'procuro', 'teria', 'teriam',
    'se', 'possivel', 'possível', 'tem aí', 'tem ai', 'aí', 'ai', 'aqui',
    'quero', 'queria', 'separar', 'separa', 'comprar', 'levar', 'mandar'
  ];

  const stopRegex = new RegExp(`\\b(${stopwords.join('|')})\\b`, 'gi');
  cleaned = cleaned.replace(stopRegex, ' ').replace(/\s+/g, ' ').trim();

  if (!cleaned) return [];

  // Divide múltiplos produtos por conjunções ("e", "mais", ",", "/")
  const terms = cleaned
    .split(/\s+e\s+|\s*,\s*|\s+mais\s+|\s*\/\s*|\s+com\s+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (terms.length === 0 && cleaned.length >= 2) {
    return [cleaned];
  }

  return terms;
}

/**
 * Busca produtos no banco de dados SQLite com inteligência de relevância
 */
function searchProductsInDb(tenantId, query) {
  if (!query || query.length < 2) return [];
  const cleanQ = query.trim();

  const sql = `
    SELECT id, tenant_id, name, active_ingredient, dosage, form, presentation, barcode,
           sale_price, original_price, is_promotion, stock_quantity, reserved_quantity,
           requires_prescription
    FROM products
    WHERE tenant_id = ? AND active = 1 AND (
      name LIKE ? OR active_ingredient LIKE ? OR barcode = ?
    )
    ORDER BY 
      CASE 
        WHEN name LIKE ? THEN 1
        WHEN name LIKE ? THEN 2
        WHEN active_ingredient LIKE ? THEN 3
        ELSE 4
      END,
      stock_quantity DESC
    LIMIT 3
  `;

  try {
    return db.prepare(sql).all(
      tenantId,
      `%${cleanQ}%`,
      `%${cleanQ}%`,
      cleanQ,
      `${cleanQ}%`,
      `% ${cleanQ}%`,
      `${cleanQ}%`
    );
  } catch (err) {
    console.error('[aiEngine] Erro ao buscar produtos:', err.message);
    return [];
  }
}

function formatMoney(val) {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Chamada à API oficial do Google Gemini (REST) com histórico conversacional
 */
async function callGeminiApi({ apiKey, systemInstruction, userPrompt, history = [], model = 'gemini-2.5-flash' }) {
  const modelsToTry = [model, 'gemini-2.0-flash', 'gemini-1.5-flash'];

  // Constrói formato multi-turn do Gemini
  const contents = [];
  if (Array.isArray(history) && history.length > 0) {
    for (const h of history.slice(-6)) {
      contents.push({
        role: h.from_me === 1 ? 'model' : 'user',
        parts: [{ text: h.text || '' }],
      });
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }],
  });

  for (const currentModel of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
      },
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[aiEngine] Gemini (${currentModel}) retornou status ${res.status}: ${errText.substring(0, 100)}`);
        continue;
      }

      const data = await res.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer && answer.trim()) {
        return answer.trim();
      }
    } catch (err) {
      console.warn(`[aiEngine] Falha ao chamar Gemini modelo ${currentModel}:`, err.message);
    }
  }

  return null;
}

/**
 * Motor de Vendas Humanizado (Local) - Conduz o cliente até o fechamento da compra
 * sem menus robóticos, sem barras ASCII e sem "digite 0"
 */
function buildConversationalSalesResponse({ tenant, customerName, searchResults, rawText, context = {} }) {
  const lower = rawText.toLowerCase().trim();

  // 1. Cliente escolhendo ENTREGA
  if (
    lower === 'entrega' ||
    lower === 'entregar' ||
    lower === 'pode entregar' ||
    lower === 'manda entregar' ||
    lower === 'quero entrega' ||
    lower === 'prefiro entrega' ||
    lower.includes('pode ser entrega') ||
    lower.includes('faz entrega') ||
    lower.includes('entrega em casa')
  ) {
    const feeText = Number(tenant.delivery_fee_default) > 0
      ? `R$ ${formatMoney(tenant.delivery_fee_default)}`
      : 'grátis';

    return {
      text:
        `Maravilha, ${customerName}! 🛵\n\n` +
        `Nossa entrega sai por apenas ${feeText} e o motoboy leva rapidinho aí para você.\n\n` +
        `Por favor, me passa o seu *endereço completo com número, bairro e um ponto de referência* para eu já calcular e agendar o envio?`,
      candidates: context.candidates || [],
      intent: 'asking_address'
    };
  }

  // 2. Cliente escolhendo RETIRADA NO BALCÃO
  if (
    lower === 'retirar' ||
    lower === 'retirada' ||
    lower === 'vou retirar' ||
    lower === 'vou passar aí' ||
    lower === 'passo aí' ||
    lower === 'pego no balcão' ||
    lower.includes('retirar no balcão') ||
    lower.includes('vou buscar')
  ) {
    return {
      text:
        `Perfeito, ${customerName}! 😊\n\n` +
        `Nosso endereço é: *${tenant.address || 'no nosso balcão central'}* (estamos abertos ${tenant.business_hours || 'das 08:00 às 22:00'}).\n\n` +
        `Já deixo tudo separadinho com seu nome aqui no caixa para você só chegar e retirar!\n\n` +
        `Você prefere pagar antecipado no Pix para já adiantar ou vai pagar direto aqui no caixa na retirada?`,
      candidates: context.candidates || [],
      intent: 'pickup_confirmed'
    };
  }

  // 3. Cliente informando ENDEREÇO
  const hasAddressSignal =
    (lower.includes('rua') || lower.includes('av') || lower.includes('avenida') || lower.includes('bairro') || lower.includes('casa') || lower.includes('apto') || lower.includes('número') || lower.includes('numero') || lower.includes('nº')) &&
    /\d+/.test(lower);

  if (hasAddressSignal) {
    const deliveryFee = Number(tenant.delivery_fee_default) || 7.00;
    return {
      text:
        `Endereço anotado com sucesso, ${customerName}! ✅\n\n` +
        `Nossa entrega já vai ser despachada para você.\n\n` +
        `Como você prefere fazer o pagamento? Pode ser no *Pix* (Copia e Cola instantâneo) ou na *maquininha de cartão* quando o motoboy chegar?`,
      candidates: context.candidates || [],
      intent: 'asking_payment'
    };
  }

  // 4. Cliente escolhendo FORMA DE PAGAMENTO PIX
  if (lower === 'pix' || lower.includes('no pix') || lower.includes('chave pix') || lower.includes('manda o pix') || lower.includes('pode mandar o pix')) {
    const pixKey = tenant.pix_key || '12345678000190';
    return {
      text:
        `Ótimo! Aqui está a chave Pix oficial da ${tenant.name}:\n\n` +
        `💠 *Chave Pix (${(tenant.pix_type || 'CNPJ').toUpperCase()}):*\n` +
        `\`${pixKey}\`\n\n` +
        `Assim que fizer a transferência, só me manda o comprovante aqui nessa conversa que já libero a saída imediata do motoboy para você! 🛵💨`,
      candidates: context.candidates || [],
      intent: 'pix_sent'
    };
  }

  // 5. Cliente escolhendo CARTÃO OU DINHEIRO
  if (lower.includes('cartao') || lower.includes('cartão') || lower.includes('crédito') || lower.includes('credito') || lower.includes('débito') || lower.includes('debito') || lower.includes('maquininha')) {
    return {
      text:
        `Combinado! Já separei seus medicamentos e nosso motoboy vai levar a maquininha de cartão até você. 💳\n\n` +
        `Qualquer dúvida ou se precisar de mais alguma coisa, é só me chamar aqui! Muito obrigado pela preferência e estimo melhoras! 💚`,
      candidates: context.candidates || [],
      intent: 'order_completed'
    };
  }

  if (lower.includes('dinheiro')) {
    return {
      text:
        `Perfeito! Pagamento em dinheiro na entrega. 💵\n\n` +
        `Você vai precisar de troco para quanto? Me avisa aqui que o entregador já leva certinho para você!`,
      candidates: context.candidates || [],
      intent: 'asking_change'
    };
  }

  // 6. Produtos encontrados para a pergunta
  if (searchResults && searchResults.length > 0) {
    const candidates = [];
    const productLines = [];

    searchResults.forEach((group) => {
      const p = group.products[0];
      if (!candidates.some((c) => c.id === p.id)) {
        candidates.push(p);
        const isPromo = p.is_promotion && p.original_price && Number(p.original_price) > Number(p.sale_price);
        const priceStr = isPromo
          ? `*R$ ${formatMoney(p.sale_price)}* (em oferta especial, era R$ ${formatMoney(p.original_price)})`
          : `*R$ ${formatMoney(p.sale_price)}*`;

        const desc = p.presentation ? ` (${p.presentation})` : '';
        productLines.push(`• *${p.name}*${desc} por ${priceStr}`);
      }
    });

    const msg =
      `Olá, ${customerName}! Tudo bem? 😊\n\n` +
      `Temos em nosso estoque sim:\n` +
      `${productLines.join('\n')}\n\n` +
      `Você prefere que a gente envie por entrega rápida na sua casa ou vai passar aqui na farmácia para retirar? Já posso deixar separado para você!`;

    return { text: msg, candidates, intent: 'products_offered' };
  }

  // 7. Não encontrou o produto específico
  return {
    text:
      `Olá, ${customerName}! Tudo bem? 😊\n\n` +
      `Consultei nosso sistema e não localizei esse produto cadastrado com esse nome no momento.\n\n` +
      `Nosso farmacêutico de plantão está no balcão agora e pode verificar para você se temos genéricos com o mesmo princípio ativo ou encomendar para chegar hoje mesmo! Quer que eu te passe para ele?`,
    candidates: [],
    intent: 'not_found'
  };
}

/**
 * Função principal do Atendente Virtual de Inteligência Artificial
 */
async function processAiMessage({ tenantId, customerPhone, customerName, rawText, history = [], context = {} }) {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
  if (!tenant) return null;

  // 1. Extração de termos de busca
  const queries = parseProductQueries(rawText);
  const searchResults = [];

  for (const q of queries) {
    const prods = searchProductsInDb(tenantId, q);
    if (prods.length > 0) {
      searchResults.push({ query: q, products: prods });
    }
  }

  const allCandidates = [];
  searchResults.forEach((group) => {
    group.products.forEach((p) => {
      if (!allCandidates.some((c) => c.id === p.id)) {
        allCandidates.push(p);
      }
    });
  });

  const apiKey = tenant.gemini_api_key || process.env.GEMINI_API_KEY;
  const isAiActive = tenant.ai_enabled !== 0;

  // Se houver chave Gemini e IA ativada, chama a IA generativa com foco em vendas
  if (apiKey && isAiActive) {
    let productsContextStr = 'Nenhum medicamento específico encontrado diretamente pelo termo.';
    if (allCandidates.length > 0) {
      productsContextStr = allCandidates
        .map(
          (p) =>
            `- [ID ${p.id}] ${p.name} | Apresentação: ${p.presentation || 'N/A'} | Preço: R$ ${formatMoney(p.sale_price)}${p.is_promotion ? ` (Promoção de R$ ${formatMoney(p.original_price)})` : ''} | Estoque disponível: ${p.stock_quantity - p.reserved_quantity} un.`
        )
        .join('\n');
    }

    const systemInstruction = `
Você é o atendente de vendas e consultor farmacêutico da farmácia "${tenant.name}" no WhatsApp.
Seu objetivo é conversar com o cliente de forma 100% humana, acolhedora, simpática e CONDUZIR O CLIENTE COM ELEGÂNCIA ATÉ O FECHAMENTO DA COMPRA.

DADOS DA FARMÁCIA:
- Nome: ${tenant.name}
- Endereço: ${tenant.address || 'Nossa loja no centro da cidade'}
- Horário: ${tenant.business_hours || '08:00 às 22:00'}
- Taxa de entrega padrão: R$ ${formatMoney(tenant.delivery_fee_default)} ${Number(tenant.free_shipping_threshold) > 0 ? `(Frete GRÁTIS acima de R$ ${formatMoney(tenant.free_shipping_threshold)})` : ''}
- Formas de pagamento: Pix instantâneo, Cartão de crédito/débito na maquininha na entrega, Dinheiro. Chave Pix: ${tenant.pix_key || 'Chave da farmácia'}

PRODUTOS EM ESTOQUE NO SISTEMA:
${productsContextStr}

DIRETRIZES DE ATENDIMENTO DE ALTA CONVERSÃO:
1. NUNCA use marcadores robóticos como "━━━━━━━", "Princípio:", "Apresentação:", "[ 1 ]", "[ 2 ]", ou "Digite 0". Fale como uma pessoa real no WhatsApp!
2. Quando o cliente perguntar o valor de um ou mais remédios, cite os preços reais com clareza e pergunte logo em seguida: "Você prefere que a gente entregue na sua casa ou vai passar aqui na farmácia para retirar? Já posso deixar separadinho para você!"
3. Se o cliente preferir entrega, peça o endereço com número e bairro para calcular e despachar.
4. Quando o cliente der o endereço, confirme e pergunte a forma de pagamento (Pix ou Cartão na maquininha).
5. Se for Pix, informe a chave Pix e peça o comprovante para liberar o motoboy.
6. Mantenha as mensagens curtas, naturais e com emojis amigáveis (😊, 💊, 🛵, 💚).
7. Se o cliente pedir expressamente para falar com uma pessoa, atenda com carinho e adicione [TRANSF_HUMANO] no final.
`.trim();

    const userPrompt = `Mensagem do cliente (${customerName || 'Cliente'}): "${rawText}"`;

    try {
      const aiReply = await callGeminiApi({
        apiKey,
        systemInstruction,
        userPrompt,
        history,
      });

      if (aiReply) {
        const wantsHuman = aiReply.includes('[TRANSF_HUMANO]');
        const cleanReply = aiReply.replace('[TRANSF_HUMANO]', '').trim();

        return {
          text: cleanReply,
          candidates: allCandidates,
          wantsHuman,
          source: 'gemini',
        };
      }
    } catch (e) {
      console.warn('[aiEngine] Erro na execução da IA, caindo para motor de vendas local:', e.message);
    }
  }

  // Motor Conversacional de Vendas Local (sempre ativo, zero custo e altamente vendedor)
  const salesResult = buildConversationalSalesResponse({
    tenant,
    customerName: customerName || 'Cliente',
    searchResults,
    rawText,
    context,
  });

  return {
    text: salesResult.text,
    candidates: salesResult.candidates || allCandidates,
    wantsHuman: false,
    source: 'local_sales_nlp',
    intent: salesResult.intent,
  };
}

/**
 * Gera uma sugestão de resposta para o atendente/farmacêutico usar no painel do CRM
 */
async function suggestSalesResponse({ tenantId, customerPhone }) {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
  if (!tenant) return null;

  // Busca as últimas mensagens da conversa
  const history = db
    .prepare('SELECT from_me, text, timestamp FROM messages WHERE tenant_id = ? AND customer_phone = ? ORDER BY id DESC LIMIT 6')
    .all(tenantId, customerPhone)
    .reverse();

  const conv = db
    .prepare('SELECT customer_name FROM conversations WHERE tenant_id = ? AND customer_phone = ?')
    .get(tenantId, customerPhone);
  const customerName = conv?.customer_name || 'Cliente';

  // Última mensagem enviada pelo cliente
  const lastCustomerMsg = [...history].reverse().find((m) => m.from_me === 0);
  const textToAnalyze = lastCustomerMsg?.text || '';

  const result = await processAiMessage({
    tenantId,
    customerPhone,
    customerName,
    rawText: textToAnalyze,
    history,
    context: {},
  });

  return {
    suggestion: result?.text || '',
    candidates: result?.candidates || [],
    source: result?.source || 'local',
  };
}

module.exports = {
  processAiMessage,
  suggestSalesResponse,
  parseProductQueries,
  searchProductsInDb,
};
