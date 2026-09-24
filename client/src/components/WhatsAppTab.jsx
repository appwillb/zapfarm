import React from 'react';
import { QrCode, RefreshCw, CheckCircle, PowerOff, ShieldCheck, Smartphone, Info } from 'lucide-react';

export default function WhatsAppTab({
  whatsappStatus,
  onConnect,
  onDisconnect,
  onRefresh,
}) {
  const isConnected = whatsappStatus?.status === 'connected';
  const isQrCode = whatsappStatus?.status === 'qrcode';
  const isConnecting = whatsappStatus?.status === 'connecting';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* WhatsApp Status Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : isQrCode
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <QrCode size={30} />
            </div>
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h2 className="text-lg font-bold text-slate-800">Conexão WhatsApp (Baileys)</h2>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                    isConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : isQrCode
                      ? 'bg-amber-100 text-amber-800 animate-pulse'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isConnected
                    ? 'Online & Conectado'
                    : isQrCode
                    ? 'Aguardando Leitura'
                    : isConnecting
                    ? 'Iniciando Sessão...'
                    : 'Desconectado'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Utiliza a biblioteca Baileys multi-sessão isolada para cada farmácia do SaaS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <button
                onClick={onDisconnect}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1.5 transition-colors"
              >
                <PowerOff size={14} />
                Desconectar WhatsApp
              </button>
            ) : (
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} className={isConnecting ? 'animate-spin' : ''} />
                {isConnecting ? 'Gerando QR Code...' : 'Gerar QR Code Baileys'}
              </button>
            )}
          </div>
        </div>

        {/* Dynamic State View */}
        <div className="pt-6">
          {isConnected ? (
            <div className="p-8 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle size={36} />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">WhatsApp Pareado com Sucesso!</h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Número Ativo: <strong className="font-mono text-sm">+{whatsappStatus.phone || 'Sessão Ativa'}</strong>
                </p>
                <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto">
                  O bot está ativo e respondendo aos clientes que enviam mensagens para este número, consultando medicamentos, reservando estoque e acionando motoboys!
                </p>
              </div>
            </div>
          ) : isQrCode && whatsappStatus?.qrCode ? (
            <div className="flex flex-col items-center text-center space-y-4 max-w-md mx-auto">
              <div className="p-4 bg-white rounded-2xl border-2 border-emerald-500 shadow-xl">
                <img
                  src={whatsappStatus.qrCode}
                  alt="QR Code WhatsApp Baileys"
                  className="w-64 h-64 mx-auto rounded-lg"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Aponte a câmera do WhatsApp para o QR Code acima
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  O QR Code é atualizado automaticamente pelo Baileys
                </p>
              </div>
              <button
                onClick={onConnect}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                Gerar Novo Código
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center max-w-lg mx-auto space-y-3">
              <Smartphone size={40} className="mx-auto text-slate-400" />
              <h3 className="text-sm font-bold text-slate-700">Nenhuma sessão WhatsApp ativa nesta farmácia</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Clique no botão acima para iniciar a sessão Baileys. Um QR Code será gerado para sincronizar com o aplicativo do WhatsApp no celular da farmácia.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Step by Step Guide */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Info size={16} className="text-emerald-600" />
          Como conectar o WhatsApp da sua Farmácia:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold inline-flex items-center justify-center text-[10px] mb-2">
              1
            </span>
            <p className="font-semibold text-slate-800">Abra o WhatsApp</p>
            <p className="text-slate-500 mt-1">No celular da farmácia, abra o WhatsApp normal ou Business.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold inline-flex items-center justify-center text-[10px] mb-2">
              2
            </span>
            <p className="font-semibold text-slate-800">Aparelhos Conectados</p>
            <p className="text-slate-500 mt-1">Toque nos 3 pontinhos (ou Configurações no iPhone) e selecione "Aparelhos Conectados".</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold inline-flex items-center justify-center text-[10px] mb-2">
              3
            </span>
            <p className="font-semibold text-slate-800">Conectar Aparelho</p>
            <p className="text-slate-500 mt-1">Toque em "Conectar um Aparelho" e aponte a câmera para o QR Code gerado.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold inline-flex items-center justify-center text-[10px] mb-2">
              4
            </span>
            <p className="font-semibold text-slate-800">Pronto para Vender!</p>
            <p className="text-slate-500 mt-1">O bot assume o atendimento com o catálogo do banco de dados imediatamente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
