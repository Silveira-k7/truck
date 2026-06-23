import { useState } from 'react';
import { FileText, Image, Upload, Wand2 } from 'lucide-react';
import Button from './ui/button';
import {
  buildReceiptDescription,
  extractReceiptFromFile,
  parseReceiptText,
  type ReceiptExtractionResult,
} from '../lib/receipt-extraction';

interface ReceiptExtractorProps {
  onExtract: (result: ReceiptExtractionResult) => void;
}

export default function ReceiptExtractor({ onExtract }: ReceiptExtractorProps) {
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [result, setResult] = useState<ReceiptExtractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleResult = (nextResult: ReceiptExtractionResult) => {
    setResult(nextResult);
    onExtract(nextResult);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;

    setLoading(true);
    setError('');
    setFileName(file.name);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }

    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    }

    try {
      handleResult(await extractReceiptFromFile(file));
    } catch (err) {
      console.error('Receipt extraction error:', err);
      setError('Nao foi possivel processar este arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextExtraction = () => {
    if (!rawText.trim()) {
      setError('Cole o texto da nota antes de extrair.');
      return;
    }

    setError('');
    handleResult(parseReceiptText(rawText));
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Leitor de nota fiscal</p>
          <p className="text-xs text-gray-500">
            Envie a foto ou cole o texto para preencher os campos.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer">
          <Upload className="w-4 h-4" />
          Enviar nota
          <input
            className="hidden"
            type="file"
            accept="image/*,.txt,text/plain,application/pdf"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
        <Button type="button" variant="secondary" onClick={handleTextExtraction} loading={loading}>
          <Wand2 className="w-4 h-4 mr-2" />
          Extrair texto colado
        </Button>
      </div>

      {fileName && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Image className="w-3 h-3" />
          {fileName}
          {loading && <span className="text-primary-600">Lendo imagem...</span>}
        </div>
      )}

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Previa do comprovante"
          className="max-h-28 w-full rounded-lg border border-gray-200 object-contain bg-white"
        />
      )}

      <textarea
        value={rawText}
        onChange={(event) => setRawText(event.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        rows={2}
        placeholder="Cole aqui o texto copiado da nota fiscal, cupom ou OCR do celular..."
      />

      {error && <p className="text-sm text-danger-600">{error}</p>}

      {result && (
        <div className="rounded-lg bg-white border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">{buildReceiptDescription(result)}</p>
            <span className="text-xs text-gray-500">{Math.round(result.confidence * 100)}%</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            {result.total && <span>Total: {formatCurrency(result.total)}</span>}
            {result.date && <span>Data: {new Date(result.date).toLocaleDateString('pt-BR')}</span>}
            {result.liters && <span>Litros: {result.liters.toFixed(3)} L</span>}
            {result.pricePerLiter && <span>R$/L: {formatCurrency(result.pricePerLiter)}</span>}
          </div>
          {result.items.length > 0 && (
            <div className="space-y-1">
              {result.items.slice(0, 4).map((item, index) => (
                <div key={`${item.description}-${index}`} className="flex justify-between gap-3 text-xs text-gray-600">
                  <span className="truncate">{item.description}</span>
                  <span>{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          )}
          {result.warnings.map((warning) => (
            <p key={warning} className="text-xs text-warning-700">{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
