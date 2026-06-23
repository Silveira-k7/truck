import type { ExpenseCategory } from './types';

export interface ReceiptItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
}

export interface ReceiptExtractionResult {
  rawText: string;
  source: 'text' | 'qr_code' | 'image';
  issuer?: string;
  date?: string;
  total?: number;
  categorySuggestion?: ExpenseCategory;
  city?: string;
  state?: string;
  liters?: number;
  pricePerLiter?: number;
  items: ReceiptItem[];
  warnings: string[];
  confidence: number;
  receiptUrl?: string;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

const moneyPattern = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{1,3}|\d+\.\d{1,3})/gi;

export async function extractReceiptFromFile(file: File): Promise<ReceiptExtractionResult> {
  const receiptUrl = await readReceiptUrl(file);

  if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
    const text = await file.text();
    return { ...parseReceiptText(text, 'text'), receiptUrl };
  }

  if (file.type.startsWith('image/')) {
    const qrText = await readQrCode(file);
    if (qrText) {
      return { ...parseReceiptText(qrText, 'qr_code'), receiptUrl };
    }

    const ocrText = await readImageText(file);
    if (ocrText.trim()) {
      return {
        ...parseReceiptText(ocrText, 'image'),
        receiptUrl,
      };
    }

    return {
      rawText: '',
      source: 'image',
      items: [],
      warnings: [
        'Imagem anexada. Nao foi possivel ler texto automaticamente neste navegador; cole o texto da nota para preencher os campos.',
      ],
      confidence: 0,
      receiptUrl,
    };
  }

  return {
    rawText: '',
    source: 'image',
    items: [],
    warnings: ['Arquivo anexado. Para extrair dados, cole o texto da nota no campo abaixo.'],
    confidence: 0,
    receiptUrl,
  };
}

export function parseReceiptText(text: string, source: ReceiptExtractionResult['source'] = 'text'): ReceiptExtractionResult {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const issuer = findIssuer(lines);
  const date = findDate(text);
  const total = findTotal(lines);
  const items = findItems(lines);
  const categorySuggestion = suggestCategory(normalized);
  const { liters, pricePerLiter } = findFuelData(text, total);
  const { city, state } = findCityState(lines);

  const warnings: string[] = [];
  if (!total) warnings.push('Valor total nao identificado automaticamente.');
  if (source === 'qr_code') warnings.push('QR code lido. Algumas notas nao incluem itens detalhados no QR.');
  if (items.length === 0) warnings.push('Itens nao identificados; confira a descricao antes de salvar.');

  const filledFields = [issuer, date, total, categorySuggestion, city, liters, pricePerLiter].filter(Boolean).length;
  const confidence = Math.min(0.95, Math.max(0.15, filledFields / 7 + Math.min(items.length, 3) * 0.08));

  return {
    rawText: text,
    source,
    issuer,
    date,
    total,
    categorySuggestion,
    city,
    state,
    liters,
    pricePerLiter,
    items,
    warnings,
    confidence,
  };
}

export function buildReceiptDescription(result: ReceiptExtractionResult): string {
  const parts = [
    result.issuer,
    result.items.slice(0, 3).map((item) => item.description).join(', '),
  ].filter(Boolean);

  return parts.join(' - ') || 'Despesa importada de comprovante';
}

function findIssuer(lines: string[]) {
  return lines.find((line) => {
    const upper = line.toUpperCase();
    return (
      line.length >= 3 &&
      !upper.includes('CNPJ') &&
      !upper.includes('CPF') &&
      !upper.includes('DANFE') &&
      !upper.includes('NFC-E') &&
      findMoneyValues(line).length === 0
    );
  });
}

function findDate(text: string) {
  const match = text.match(/(\d{2})[/.-](\d{2})[/.-](\d{2,4})/);
  if (!match) return undefined;

  const [, day, month, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month}-${day}`;
}

function findTotal(lines: string[]) {
  const totalLines = lines.filter((line) =>
    /valor\s+total|total\s*(?:r\$|geral|a\s+pagar)?|vl\.?\s*total/i.test(line) &&
    !/subtotal|tributos|aprox|troco/i.test(line)
  );

  for (const line of totalLines) {
    const totalLineValues = findMoneyValues(line);
    const fromTotalLine = totalLineValues.length > 0 ? totalLineValues[totalLineValues.length - 1] : undefined;
    if (fromTotalLine) return fromTotalLine;
  }

  const values = lines
    .filter((line) => !isDocumentOrMetadataLine(line))
    .flatMap((line) => findMoneyValues(line));
  if (values.length === 0) return undefined;
  return Math.max(...values);
}

function findItems(lines: string[]): ReceiptItem[] {
  return lines
    .map<ReceiptItem | null>((line) => {
      if (/total|subtotal|troco|cart[aã]o|dinheiro|cnpj|cpf|chave|consulta/i.test(line)) return null;
      const values = findMoneyValues(line);
      if (values.length < 1) return null;

      const total = values[values.length - 1];
      if (!total) return null;

      const description = line
        .replace(moneyPattern, '')
        .replace(/\b\d+[,.]?\d*\s*(?:un|und|kg|l|lt|x)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (description.length < 3) return null;

      return {
        description,
        unitPrice: values.length > 1 ? values[values.length - 2] : undefined,
        total,
      };
    })
    .filter((item): item is ReceiptItem => Boolean(item))
    .slice(0, 12);
}

function suggestCategory(text: string): ExpenseCategory | undefined {
  const upper = text.toUpperCase();
  if (/DIESEL|COMBUST[IÍ]VEL|POSTO|GASOLINA|ARLA/.test(upper)) return upper.includes('ARLA') ? 'arla' : 'diesel';
  if (/PED[AÁ]GIO|CONCESSION[AÁ]RIA|RODOVIA/.test(upper)) return 'toll';
  if (/RESTAURANTE|LANCHONETE|REFEI[CÇ][AÃ]O|ALIMENT/.test(upper)) return 'food';
  if (/HOTEL|POUSADA|PERNOITE/.test(upper)) return 'overnight';
  if (/ESTACIONAMENTO|PARKING/.test(upper)) return 'parking';
  if (/OFICINA|AUTO\s*PE[CÇ]AS|MEC[AÂ]NICA|BORRACHARIA|PNEU/.test(upper)) {
    return /BORRACHARIA|PNEU/.test(upper) ? 'tire' : 'workshop';
  }
  if (/LAVA|LAVAGEM/.test(upper)) return 'wash';
  if (/MULTA|INFRA[CÇ][AÃ]O/.test(upper)) return 'fine';
  return undefined;
}

function findFuelData(text: string, total?: number) {
  const fromItemLine = findFuelItemData(text, total);
  if (fromItemLine.liters || fromItemLine.pricePerLiter) return fromItemLine;

  const litersMatch = text.match(/(\d+[,.]\d{1,3})\s*(?:L|LT|LITROS?)\b/i);
  const priceMatch = text.match(/(?:PRE[CÇ]O|VALOR|VL\.?)\s*(?:POR)?\s*(?:LITRO|L|UNIT[AÁ]RIO|UN)?[^\d]*(\d+[,.]\d{2,3})/i);
  const liters = litersMatch ? parseBrazilianNumber(litersMatch[1]) : undefined;
  let pricePerLiter = priceMatch ? parseBrazilianNumber(priceMatch[1]) : undefined;

  if (!pricePerLiter && liters && total) {
    pricePerLiter = total / liters;
  }

  return { liters, pricePerLiter };
}

function findFuelItemData(text: string, total?: number) {
  const fuelLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /combust|gasolin|diesel|etanol|arla/i.test(line));

  if (!fuelLine) return {};

  const explicitValues = findMoneyValues(fuelLine);
  if (explicitValues.length >= 2) {
    const liters = explicitValues[0];
    const pricePerLiter = total && liters ? total / liters : explicitValues[1];
    return { liters, pricePerLiter };
  }

  const compactMatch = fuelLine.match(/(?:combust\S*|gasolin\S*|diesel|etanol|arla).*?(\d{2})\s+(\d{2})(\d{2,3})\s+(\d{3,4})/i);
  if (compactMatch) {
    const liters = Number(`${compactMatch[1]}.${compactMatch[2]}`);
    const pricePerLiter = total && liters ? total / liters : Number(`${compactMatch[3][0]}.${compactMatch[3].slice(1)}`);
    return { liters, pricePerLiter };
  }

  return {};
}

function findCityState(lines: string[]) {
  for (const line of lines) {
    const match = line.match(/\b([A-ZÀ-Ú][A-ZÀ-Ú\s.'-]{2,}),?\s*[-/]\s*([A-Z]{2})\b/);
    if (match) {
      return {
        city: titleCase(match[1].trim()),
        state: match[2],
      };
    }
  }

  return {};
}

function findMoneyValues(text: string) {
  if (isDocumentOrMetadataLine(text)) return [];

  moneyPattern.lastIndex = 0;
  return [...text.matchAll(moneyPattern)]
    .map((match) => parseBrazilianNumber(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function parseBrazilianNumber(value: string) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value.replace(/,/g, '');
  return Number(normalized);
}

function isDocumentOrMetadataLine(text: string) {
  return /\b(?:CNPJ|CNP|CPF|CEP|IE|IM|MD-?5|CHAVE|PROTOCOLO|CCF|COO|IRF|TEL|RUA)\b/i.test(text);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

async function readQrCode(file: File) {
  const Detector = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) return undefined;

  const bitmap = await createImageBitmap(file);
  try {
    const detector = new Detector({ formats: ['qr_code'] });
    const codes = await detector.detect(bitmap);
    return codes[0]?.rawValue;
  } catch {
    return undefined;
  } finally {
    bitmap.close();
  }
}

async function readReceiptUrl(file: File) {
  if (file.size > 1_500_000) return undefined;

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readImageText(file: File) {
  const image = await readDataUrl(file, 6_000_000);
  if (!image) return '';

  try {
    const response = await fetch('/api/receipt-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, name: file.name }),
    });

    if (!response.ok) return '';

    const data = await response.json();
    return typeof data.text === 'string' ? data.text : '';
  } catch (error) {
    console.error('OCR request failed:', error);
    return '';
  }
}

async function readDataUrl(file: File, maxSize: number) {
  if (file.size > maxSize) return undefined;

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
