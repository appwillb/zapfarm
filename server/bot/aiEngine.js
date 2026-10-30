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

/**
 * Mapeamento de sintomas comuns para Medicamentos Isentos de Prescrição (MIPs / Venda Livre)
 * ANVISA Compliance: Apenas medicamentos que NÃO precisam de receita médica e que constam no estoque da farmácia!
 */
const SYMPTOM_OTC_MAPPINGS = [
  {
    triggers: [
      'garganta', 'inflamacao', 'inflamação', 'inflamada', 'inflamar',
      'arranhando', 'rouquidao', 'rouquidão', 'rouco', 'rouca', 'engolir',
      'amigdala', 'amígdala', 'amigdalite'
    ],
    searchKeywords: ['ciflogex', 'benalet', 'flogoral', 'pastilha', 'spray', 'dipirona', 'ibuprofeno'],
    categoryLabel: 'Alívio para dor e inflamação na garganta'
  },
  {
    triggers: [
      'cabeca', 'cabeça', 'enxaqueca', 'dor de cabeca', 'dor de cabeça', 'tontura'
    ],
    searchKeywords: ['dipirona', 'paracetamol', 'neosaldina', 'doralgina', 'dorflex'],
    categoryLabel: 'Analgésicos para dor de cabeça'
  },
  {
    triggers: [
      'gripe', 'gripado', 'gripada', 'resfriado', 'resfriada', 'coriza',
      'espirro', 'espirros', 'congestao', 'congestão', 'febre', 'corpo dolorido'
    ],
    searchKeywords: ['cimegripe', 'coristina', 'resfenol', 'dipirona', 'paracetamol'],
    categoryLabel: 'Antigripais e antitérmicos'
  },
  {
    triggers: [
      'azia', 'estomago', 'estômago', 'queimacao', 'queimação', 'refluxo',
      'ma digestao', 'má digestão', 'empachado', 'empachada', 'enjoo', 'enjôo', 'vomito', 'vômito'
    ],
    searchKeywords: ['estomazil', 'eno', 'sonrisal', 'omeprazol', 'epocler', 'dramin'],
    categoryLabel: 'Antiácidos e digestivos'
  },
  {
    triggers: [
      'muscular', 'costas', 'coluna', 'torcicolo', 'musculo', 'músculo',
      'dor no corpo', 'lombar', 'lombalgia', 'distensao', 'distensão', 'contusao', 'contusão'
    ],
    searchKeywords: ['dorflex', 'doralgina', 'ibuprofeno', 'tandrilax', 'salonpas', 'cataflam'],
    categoryLabel: 'Relaxantes musculares e dores no corpo'
  },
  {
    triggers: [
      'alergia', 'coceira', 'rinite', 'pele vermelha', 'urticaria', 'urticária', 'picada'
    ],
    searchKeywords: ['loratadina', 'polaramine', 'desloratadina', 'allegra', 'antialergico'],
    categoryLabel: 'Antialérgicos de venda livre'
  }
];

function findOtcProductsForSymptoms(tenantId, text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  
  const matchedKeywords = new Set();
  for (const map of SYMPTOM_OTC_MAPPINGS) {
    if (map.triggers.some(t => lower.includes(t))) {
      map.searchKeywords.forEach(k => matchedKeywords.add(k));
    }
  }

  if (matchedKeywords.size === 0) return [];

  const found = [];
  for (const kw of matchedKeywords) {
    try {
      const items = db.prepare(`
        SELECT id, tenant_id, name, active_ingredient, dosage, form, presentation, barcode,
               sale_price, original_price, is_promotion, stock_quantity, reserved_quantity,
               requires_prescription
        FROM products
        WHERE tenant_id = ? AND active = 1 AND requires_prescription = 0 AND stock_quantity > 0 AND (
          name LIKE ? OR active_ingredient LIKE ?
        )
        ORDER BY stock_quantity DESC
        LIMIT 2
      `).all(tenantId, `%${kw}%`, `%${kw}%`);

      for (const it of items) {
        if (!found.some(f => f.id === it.id)) {
          found.push(it);
        }
      }
    } catch (e) {
      console.warn('[aiEngine] Erro ao buscar OTC para sintomas:', e.message);
    }
  }

  return found.slice(0, 6);
}

function formatMoney(val) {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Chamada à API oficial do Google Gemini (REST) com histórico conversacional
 */
async function callGeminiApi({ apiKey, systemInstruction, userPrompt, history = [], model = 'gemini-3.8-flash' }) {
  const modelsToTry = [
    model,
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash'
  ];

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
        maxOutputTokens: 800,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8500);

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
        `📍 *Para traçar a rota exata no GPS do motoboy (sistema Rota88):*\n` +
        `1. Toque no ícone de *Clipe 📎* (ou *+* no iPhone) aqui embaixo no WhatsApp;\n` +
        `2. Selecione *Localização*;\n` +
        `3. Escolha *Enviar sua localização atual*.\n\n` +
        `E me manda também o *número da casa e complemento* para o entregador achar certinho! 😊`,
      candidates: context.candidates || [],
      intent: 'asking_location'
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

  // 3. Cliente enviando LOCALIZAÇÃO GPS ou informando ENDEREÇO
  const hasGpsSignal = context?.has_gps_location || lower.includes('localização gps') || lower.includes('lat:') || lower.includes('lng:');
  const hasAddressSignal =
    (lower.includes('rua') || lower.includes('av') || lower.includes('avenida') || lower.includes('bairro') || lower.includes('casa') || lower.includes('apto') || lower.includes('número') || lower.includes('numero') || lower.includes('nº')) &&
    /\d+/.test(lower);

  if (hasGpsSignal) {
    return {
      text:
        `Localização GPS recebida com sucesso, ${customerName}! 📍🛵\n\n` +
        `A rota já foi registrada no nosso sistema de entregas para o motoboy.\n\n` +
        `Como você prefere fazer o pagamento? Pode ser no *Pix* (Copia e Cola instantâneo) ou na *maquininha de cartão* quando o entregador chegar?`,
      candidates: context.candidates || [],
      intent: 'asking_payment'
    };
  }

  if (hasAddressSignal) {
    return {
      text:
        `Endereço anotado: *${rawText}*! 📝\n\n` +
        `Agora só falta você me enviar a sua *Localização Atual pelo WhatsApp* para o sistema de entregas (Rota88) traçar a rota exata no GPS do motoboy:\n` +
        `📍 Toque no ícone de *Clipe 📎* (ou *+*) > *Localização* > *Enviar sua localização atual*.\n\n` +
        `E me fala: você prefere pagar no *Pix* ou na *maquininha de cartão* quando o motoboy chegar? 😊`,
      candidates: context.candidates || [],
      intent: 'asking_location'
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
  const candidateList = (context?.candidates && context.candidates.length > 0)
    ? context.candidates
    : (searchResults && searchResults.length > 0 ? searchResults.flatMap(g => g.products) : []);

  if (candidateList && candidateList.length > 0) {
    const candidates = [];
    const productLines = [];

    candidateList.forEach((p) => {
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

  // 1. Extração de termos de busca na mensagem atual
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

  // Se o cliente estiver relatando sintomas (ex: dor de garganta, dor de cabeça, febre, azia), busca no estoque real da farmácia apenas MIPs / Venda Livre disponíveis!
  const symptomOtcItems = findOtcProductsForSymptoms(tenantId, rawText);
  for (const otc of symptomOtcItems) {
    if (!allCandidates.some((c) => c.id === otc.id)) {
      allCandidates.push(otc);
    }
  }

  // Se a mensagem atual foi apenas confirmação/endereço ("pode entregar", "sim"), busca produtos do contexto ou da última mensagem do cliente
  if (allCandidates.length === 0 && context?.selected_product) {
    allCandidates.push(context.selected_product);
  }
  if (allCandidates.length === 0 && Array.isArray(context?.candidates)) {
    context.candidates.forEach((c) => {
      if (!allCandidates.some((p) => p.id === c.id)) allCandidates.push(c);
    });
  }
  if (allCandidates.length === 0 && Array.isArray(history) && history.length > 0) {
    const lastUserMsg = [...history].reverse().find((h) => h.from_me === 0 && h.text);
    if (lastUserMsg) {
      const prevQueries = parseProductQueries(lastUserMsg.text);
      for (const pq of prevQueries) {
        const prods = searchProductsInDb(tenantId, pq);
        for (const p of prods) {
          if (!allCandidates.some((c) => c.id === p.id)) {
            allCandidates.push(p);
          }
        }
      }
      const prevOtc = findOtcProductsForSymptoms(tenantId, lastUserMsg.text);
      for (const otc of prevOtc) {
        if (!allCandidates.some((c) => c.id === otc.id)) {
          allCandidates.push(otc);
        }
      }
    }
  }

  const apiKey = tenant.gemini_api_key || process.env.GEMINI_API_KEY;
  const isAiActive = tenant.ai_enabled !== 0;

  // Se houver chave Gemini e IA ativada, chama a IA generativa com foco em vendas
  if (apiKey && isAiActive) {
    let productsContextStr = 'Nenhum medicamento específico encontrado diretamente no estoque.';
    if (allCandidates.length > 0) {
      productsContextStr = allCandidates
        .map((p) => {
          const avail = p.stock_quantity - (p.reserved_quantity || 0);
          const rxTag = p.requires_prescription
            ? '[⚠️ EXIGE RECEITA MÉDICA - RETENÇÃO ANVISA. NUNCA INDIQUE PARA TRATAMENTO SINTOMÁTICO SEM O CLIENTE APRESENTAR RECEITA MÉDICA!]'
            : '[VENDA LIVRE / MIP - Pode ser indicado para alívio de sintomas leves]';
          return `- [ID ${p.id}] ${p.name} | Apresentação: ${p.presentation || 'N/A'} | Preço Real: R$ ${formatMoney(p.sale_price)}${p.is_promotion ? ` (Promoção de R$ ${formatMoney(p.original_price)})` : ''} | Estoque disponível: ${avail} un. | ${rxTag}`;
        })
        .join('\n');
    }

    const systemInstruction = `
Você é o atendente de vendas e consultor farmacêutico da farmácia "${tenant.name}" no WhatsApp.
Seu objetivo é conversar com o cliente de forma 100% humana, acolhedora, ética, responsável e CONDUZIR O CLIENTE COM ELEGÂNCIA ATÉ O FECHAMENTO DA COMPRA.

DADOS DA FARMÁCIA:
- Nome: ${tenant.name}
- Endereço: ${tenant.address || 'Nossa loja no centro da cidade'}
- Horário: ${tenant.business_hours || '08:00 às 22:00'}
- Taxa de entrega padrão: R$ ${formatMoney(tenant.delivery_fee_default)} ${Number(tenant.free_shipping_threshold) > 0 ? `(Frete GRÁTIS acima de R$ ${formatMoney(tenant.free_shipping_threshold)})` : ''}
- Formas de pagamento: Pix instantâneo, Cartão de crédito/débito na maquininha na entrega, Dinheiro. Chave Pix: ${tenant.pix_key || 'Chave da farmácia'}

PRODUTOS REAIS EM ESTOQUE NO SISTEMA DA FARMÁCIA:
${productsContextStr}

DIRETRIZES DE ATENDIMENTO, ÉTICA FARMACÊUTICA E LEGISLAÇÃO ANVISA (COMPLIANCE OBRIGATÓRIO):
1. NUNCA, SOB HIPÓTESE ALGUMA, INDIQUE OU PRESCREVA ANTIBIÓTICOS (ex: Amoxicilina, Azitromicina, Cefalexina, Ciprofloxacino, etc.) OU MEDICAMENTOS CONTROLADOS (Tarja Preta / Vermelha sob Retenção). É PROIBIDO por lei e pelas normas da ANVISA indicar antibiótico sem prescrição médica!
2. O QUE VOCÊ PODE INDICAR PARA SINTOMAS: Somente Medicamentos Isentos de Prescrição (MIPs / Venda Livre) que constam no estoque real acima (ex: pastilhas para garganta como Ciflogex/Benalet, sprays bucais, analgésicos e antitérmicos simples como Dipirona/Paracetamol)!
3. FIDELIDADE ABSOLUTA AOS PREÇOS DO ESTOQUE: Você NUNCA deve inventar, estimar ou chutar preços! Cite exclusivamente o nome e o preço exato em R$ dos produtos cadastrados no estoque informado acima. Se um produto não estiver na lista ou você não souber o preço, diga que nosso farmacêutico no balcão vai checar o sistema e NÃO chute valores fictícios!
4. Se o cliente perguntar de antibióticos ou se os sintomas forem severos (febre alta persistente, pus): oriente com carinho que antibióticos exigem receita médica com retenção pela ANVISA. Se o cliente já tiver a receita médica em mãos, peça para enviar uma foto nítida dela aqui pelo WhatsApp que o farmacêutico orça na hora!
5. LOGÍSTICA E ROTA88 (OBRIGATÓRIO): Se o cliente escolher ENTREGA ou passar endereço por escrito, é INDISPENSÁVEL pedir para o cliente ENVIAR A SUA LOCALIZAÇÃO ATUAL DO WHATSAPP (pelo botão de Clipe 📎 ou "+" > Localização > Enviar Localização Atual) junto com o número da casa e complemento. O sistema logístico Rota88 exige as coordenadas de GPS para criar a rota do motoboy no mapa e não errar o portão.
6. Quando o cliente enviar a localização GPS (ou se já tiver enviado), confirme com entusiasmo que a localização foi registrada no GPS da farmácia, informe o valor total incluindo a taxa de entrega (R$ ${formatMoney(tenant.delivery_fee_default)}) e pergunte a forma de pagamento (Pix instantâneo, Cartão de crédito/débito na maquininha ou Dinheiro com troco).
7. Se for Pix, informe a chave Pix oficial e peça o comprovante para liberar a saída imediata do motoboy.
8. NUNCA use marcadores robóticos como "━━━━━━━", "Princípio:", "[ 1 ]", "[ 2 ]", ou "Digite 0". Fale como uma pessoa real no WhatsApp com emojis amigáveis (😊, 💊, 🛵, 📍, 💚).
9. Se o cliente pedir expressamente para falar com uma pessoa, atenda com carinho e adicione [TRANSF_HUMANO] no final.
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
