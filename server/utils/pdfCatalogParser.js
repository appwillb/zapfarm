/**
 * pdfCatalogParser.js
 * Extrator e normalizador inteligente de catálogos e listas de preços de farmácias / distribuidoras em formato PDF
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const BASE_KNOWN_LABS = [
  'KLEY HERTZ', 'BIOLAB SAN', 'TEUTO SIMILA', 'TEUTO GENERI', 'PRATI-DONADU', 'PRATI-', 'PRATI',
  'NEO QUIMICA', 'MEDLEY - GEN', 'MEDLEY FARMA', 'MEDLEY', 'EUROFARMA ET', 'EUROFARMA', 'EMS INDUST',
  'EMS GENERICO', 'EMS ETICO', 'EMS', 'UNIAO QUIMIC', 'UNIAO', 'CIMED GENERI', 'CIMED', 'ACHE FARMA',
  'ACHE', 'SANOFI AVENT', 'SANOFI CHC', 'SANOFI', 'GEOLAB SIMIL', 'GEOLAB', 'GLAXOWELLC', 'GLAXOSMITH',
  'BAYER-SCHE', 'BAYER S/A', 'BAYER', 'NOVARTIS ETI', 'NOVARTIS', 'TAKEDA', 'MANTECORP', 'MOMENTA',
  'LEGRAND SIMI', 'LEGRAND ETIC', 'LEGRAND', 'GERMED ETICO', 'GERMED', 'NOVA QUIMICA', 'NOVA',
  'SANDOZ', 'APSEN', 'TORRENT', 'LIBBS', 'MERCK SHAR', 'MERCK GENERI', 'MERCK', 'PHARLAB GEN',
  'PHARLAB', 'MULTILAB SIM', 'MULTILAB GEN', 'MULTILAB', 'PROBIOTICA', 'MAX TITANIUM', 'ABNAT',
  'FARMOQUIMICA', 'BIOSINT.GENE', 'BIOSINTETICA', 'DELTA GENERI', 'DELTA', 'SERVIER', 'ARTE NATIVA',
  'ARTE NATIV', 'GROSS', 'INTENDIS B', 'WHITEHALL', 'KRESS', 'CATARINENS', 'CATARINENSE', 'CAZI',
  'BYK', 'PFIZER', 'ALTANA BYK', 'BRAVIR', 'HYPER-FARMAS', 'HYPER-DM', 'HYPER-', 'NATUBRAS', 'GENOM',
  'FARMACO', 'BALDACCI', 'MAKROFARMA', 'NATULAB', 'HEBRON', 'CRISTALIA', 'ZAMBON', 'ROCHE',
  'DIFFUCAP', 'ALLERGAN', 'ZODIAC', 'CELLERA FAR', 'BELFAR SIMIL', 'BELFAR', 'RECKITT BENC',
  'MAXINUTRI', 'FORTLIFE', 'NEWMIX SUPLE', 'NEWMIX', 'DUOM', 'SOLARIS', 'KNOLL PROD', 'HERBAMED',
  'DIVCOM PHA', 'MARJAN', 'T&J IMP.EX', 'VIDORA', 'MYLAN', 'CONVATEC', 'VICHY', 'SUPERA',
  'BRASTERAPICA', 'APISNUTRI', 'RANBAXY-GE', 'RANBAXY', 'NOVOTERAPI', 'APIS-FLORA', 'LEGRARI IN'
];

let _cachedSortedLabs = null;

function getSortedLabs() {
  if (_cachedSortedLabs) return _cachedSortedLabs;

  const labsSet = new Set(BASE_KNOWN_LABS.map(l => l.trim()));

  try {
    const jsonPath = path.join(__dirname, '../db/drogarosa_products.json');
    if (fs.existsSync(jsonPath)) {
      const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      for (const item of list) {
        if (item.manufacturer && typeof item.manufacturer === 'string') {
          const m = item.manufacturer.trim();
          if (m.length >= 2) labsSet.add(m);
        }
      }
    }
  } catch (e) {
    // Silently continue with base labs
  }

  _cachedSortedLabs = Array.from(labsSet).sort((a, b) => b.length - a.length);
  return _cachedSortedLabs;
}

/**
 * Limpa e converte strings monetárias brasileiras (ex: "1.234,50" ou "23,90") para Number float
 */
function parsePrice(str) {
  if (!str) return 0;
  const clean = String(str).replace(/[R$\s]/g, '').trim();
  if (clean.includes(',') && clean.includes('.')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0;
  }
  return parseFloat(clean) || 0;
}

/**
 * Separa de forma inteligente o nome do medicamento e o laboratório/fabricante
 */
function splitNameAndLab(str) {
  let clean = str.trim();
  let lab = '';
  const sortedLabs = getSortedLabs();
  for (const known of sortedLabs) {
    const escaped = known.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:\\s+|-)${escaped}$`, 'i');
    if (regex.test(clean)) {
      lab = known;
      clean = clean.replace(regex, '').trim();
      break;
    }
  }
  return { name: clean, manufacturer: lab };
}

/**
 * Extrai texto completo de um Buffer de PDF
 */
async function extractTextFromPdf(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const result = await parser.getText();
    return result && result.text ? result.text : '';
  } finally {
    try {
      await parser.destroy();
    } catch (e) {}
  }
}

/**
 * Parser de alta precisão para relatório de "Balanço de Estoque" (DROGAROSA e padrões similares)
 * Colunas reais do relatório: Código | Descrição | Fabricante | Qtde (Estoque) | Preço Uni.Venda | Subtotal | Perc%
 */
function parseBalancoLines(rawLines) {
  const items = [];
  let pendingDesc = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (
      line.includes('Balanço para') ||
      line.includes('Empresa :') ||
      line.includes('Estoque existente em') ||
      line.includes('Insc. Estadual') ||
      line.includes('Impresso') ||
      line.includes('Página') ||
      line.includes('Qtde.Registros') ||
      line.includes('Total Geral')
    ) {
      continue;
    }
    if (line.includes('Descrição') && line.includes('Fabricante')) continue;
    if (line === 'Preço') continue;

    const tabIdx = line.indexOf('\t');
    if (tabIdx !== -1) {
      const beforeTab = line.substring(0, tabIdx).trim();
      const afterTab = line.substring(tabIdx + 1).trim();

      // Padrão: Código (7 a 14 dígitos) + Qtde (inteiro) + Preço Uni.Venda (decimal) + Subtotal (decimal)
      const match = afterTab.match(/^(\d{7,14})\s+(\d+)\s+([\d\.,]+)\s+([\d\.,]+)/);
      if (match) {
        const code = match[1];
        const stock = parseInt(match[2], 10);
        const salePrice = parsePrice(match[3]);

        const rawFullName = [...pendingDesc, beforeTab].join(' ').trim();
        pendingDesc = [];

        const { name, manufacturer } = splitNameAndLab(rawFullName);

        items.push({
          barcode: code,
          code: code,
          name: name.toUpperCase(),
          manufacturer: manufacturer || '',
          sale_price: salePrice,
          original_price: salePrice,
          cost_price: Number((salePrice * 0.7).toFixed(2)),
          stock_quantity: stock,
          min_stock: 5,
          category: 'Medicamentos',
          is_promotion: 0
        });
        continue;
      }
    }

    if (!line.match(/^\d{7,14}/)) {
      pendingDesc.push(line);
    }
  }

  return items;
}

/**
 * Parser de alta precisão para relatório de "Lista de Preços de Tabela e Preços de Promoção"
 * Colunas reais do relatório: Descrição | Fabricante | Código | Preço Promoção (Por) | Preço Tabela (De)
 */
function parsePromoLines(rawLines) {
  const items = [];
  let pendingDesc = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (
      line.includes('DROGAROSA') ||
      line.includes('Lista de Preços') ||
      line.includes('Somente produtos') ||
      line.includes('Promoção :') ||
      line.includes('Impresso') ||
      line.includes('Página') ||
      line.includes('Qtde.Registros')
    ) {
      continue;
    }
    if (line.includes('Descrição') && line.includes('Fabricante')) continue;
    if (line === 'Preços') continue;

    const tabIdx = line.indexOf('\t');
    if (tabIdx !== -1) {
      const beforeTab = line.substring(0, tabIdx).trim();
      const afterTab = line.substring(tabIdx + 1).trim();

      // Padrão: Código (7 a 14 dígitos) + Preço 1 + Preço 2
      const match = afterTab.match(/^(\d{7,14})\s+([\d\.,]+)[\s\t]+([\d\.,]+)/);
      if (match) {
        const code = match[1];
        const val1 = parsePrice(match[2]);
        const val2 = parsePrice(match[3]);
        const promoPrice = Math.min(val1, val2);
        const originalPrice = Math.max(val1, val2);

        const rawFullName = [...pendingDesc, beforeTab].join(' ').trim();
        pendingDesc = [];

        const { name, manufacturer } = splitNameAndLab(rawFullName);

        items.push({
          barcode: code,
          code: code,
          name: name.toUpperCase(),
          manufacturer: manufacturer || '',
          original_price: originalPrice,
          sale_price: promoPrice,
          discount_percent: originalPrice > 0 ? Math.round(((originalPrice - promoPrice) / originalPrice) * 100) : 0,
          is_promotion: 1
        });
        continue;
      }
    }

    if (!line.match(/^\d{7,14}/)) {
      pendingDesc.push(line);
    }
  }

  return items;
}

/**
 * Parser de fallback para listas e catálogos genéricos
 */
function parseGenericCatalogLines(rawLines) {
  const items = [];
  const headerRegex = /^(página|pagina|relatório|relatorio|tabela|emissão|emissao|data|hora|descrição|descricao|produto|medicamento|código|codigo|ean|laboratório|laboratorio|fabr|preco|preço|estoque|qtde|qtd|valor|total|subtotal)/i;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (headerRegex.test(line) && line.length < 50) continue;

    const barcodeMatch = line.match(/\b(\d{7,14})\b/);
    const priceMatches = [...line.matchAll(/(?:R\$\s*)?(\d{1,5}[,\.]\d{2})\b/g)];

    // Se tiver preços, descarta o último se for a alíquota de ICMS (12%, 17%, 18%, 19%)
    if (priceMatches.length > 0) {
      let chosenPriceMatch = priceMatches[0];
      if (priceMatches.length >= 2) {
        const lastVal = parsePrice(priceMatches[priceMatches.length - 1][1]);
        if ([7, 12, 17, 18, 19, 20].includes(Math.round(lastVal))) {
          // Último é alíquota de ICMS, pega o anterior
          chosenPriceMatch = priceMatches[priceMatches.length - 2];
        } else {
          chosenPriceMatch = priceMatches[priceMatches.length - 1];
        }
      }

      const priceVal = parsePrice(chosenPriceMatch[1]);
      if (priceVal > 0) {
        let namePart = line
          .replace(barcodeMatch ? barcodeMatch[0] : '', ' ')
          .replace(/R\$/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (namePart.length >= 3) {
          const { name, manufacturer } = splitNameAndLab(namePart);
          items.push({
            barcode: barcodeMatch ? barcodeMatch[1] : '',
            name: name.toUpperCase(),
            manufacturer: manufacturer || '',
            sale_price: priceVal,
            original_price: priceVal,
            cost_price: Number((priceVal * 0.7).toFixed(2)),
            stock_quantity: 10,
            min_stock: 5,
            category: 'Medicamentos',
            is_promotion: 0
          });
        }
      }
    }
  }
  return items;
}

/**
 * Função principal para analisar um arquivo PDF com auto-detecção de formato
 */
async function parsePdfCatalog(pdfBuffer) {
  const fullText = await extractTextFromPdf(pdfBuffer);
  const rawLines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let fileType = 'generic';
  let items = [];

  if (fullText.includes('Lista de Preços de Tabela e Preços de Promoção') || fullText.includes('Preços de Promoção')) {
    fileType = 'promotions';
    items = parsePromoLines(rawLines);
  } else if (fullText.includes('Balanço para') || (fullText.includes('Uni.Venda') && fullText.includes('Qtde'))) {
    fileType = 'stock_balance';
    items = parseBalancoLines(rawLines);
  } else {
    items = parseGenericCatalogLines(rawLines);
  }

  return {
    fileType,
    totalExtracted: items.length,
    items,
    rawTextPreview: fullText.slice(0, 1000)
  };
}

module.exports = {
  extractTextFromPdf,
  parsePdfCatalog,
  parsePrice,
  splitNameAndLab
};
