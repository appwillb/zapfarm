import React, { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';
import { api } from '../api';

export default function CsvImportModal({ isOpen, onClose, tenantId, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const sampleCsv = `nome,principio_ativo,dosagem,apresentacao,preco_venda,estoque,requer_receita,ean
Dipirona Gotas,Dipirona Sódica,500mg/ml,Frasco 20ml,9.90,30,0,7891234567890
Amoxicilina 500mg,Amoxicilina,500mg,Caixa 21 cápsulas,42.50,15,1,7899876543210
Vitamina C 1g,Ácido Ascórbico,1000mg,Tubo 10 comprimidos,18.00,50,0,7895554443332`;

  const parseCsv = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const items = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',').map((v) => v.trim());

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });

      if (obj.nome && obj.preco_venda) {
        items.push({
          name: obj.nome,
          active_ingredient: obj.principio_ativo || '',
          dosage: obj.dosagem || '',
          presentation: obj.apresentacao || '',
          sale_price: parseFloat(obj.preco_venda.replace(',', '.')) || 0,
          stock_quantity: parseInt(obj.estoque, 10) || 10,
          requires_prescription: obj.requer_receita === '1' || obj.requer_receita === 'true',
          barcode: obj.ean || '',
          category: 'Medicamentos',
        });
      }
    }
    return items;
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setCsvText(val);
    setParsedRows(parseCsv(val));
  };

  const loadSample = () => {
    setCsvText(sampleCsv);
    setParsedRows(parseCsv(sampleCsv));
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    try {
      const res = await api.importProducts(tenantId, parsedRows);
      alert(`Importação concluída! ${res.imported} medicamento(s) inseridos no catálogo.`);
      onImported();
      onClose();
    } catch (err) {
      alert('Erro na importação: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Importação em Massa via CSV</h3>
              <p className="text-xs text-slate-500">Cole ou digite a lista de medicamentos para o catálogo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-700">Formato: nome,principio_ativo,dosagem,apresentacao,preco_venda,estoque,requer_receita,ean</span>
          <button
            type="button"
            onClick={loadSample}
            className="text-emerald-600 hover:text-emerald-700 font-semibold"
          >
            Carregar Exemplo
          </button>
        </div>

        <textarea
          rows={6}
          value={csvText}
          onChange={handleTextChange}
          placeholder="Cole aqui os dados separados por vírgula..."
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[11px] focus:outline-none focus:border-emerald-500"
        />

        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Pré-visualização: {parsedRows.length} itens válidos detectados
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Dosagem</th>
                    <th className="p-2">Preço</th>
                    <th className="p-2">Estoque</th>
                    <th className="p-2">Receita?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 font-medium text-slate-800">{r.name}</td>
                      <td className="p-2 text-slate-500">{r.dosage}</td>
                      <td className="p-2 font-bold text-slate-800">R$ {r.sale_price.toFixed(2)}</td>
                      <td className="p-2 text-slate-600">{r.stock_quantity} un.</td>
                      <td className="p-2">{r.requires_prescription ? 'Sim' : 'Não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={parsedRows.length === 0 || loading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
          >
            {loading ? 'Importando...' : `Importar ${parsedRows.length} Medicamento(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
