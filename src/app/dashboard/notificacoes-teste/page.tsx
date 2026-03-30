'use client';

import { useState } from 'react';

export default function NotificacoesTestePage() {
  const [mensagem, setMensagem] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  function addLog(msg: string) {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  async function pedirPermissao() {
    addLog('Solicitando permissão de notificação...');

    if (!('Notification' in window)) {
      addLog('❌ Este navegador não suporta notificações.');
      return;
    }

    const perm = await Notification.requestPermission();
    addLog(`Permissão: ${perm}`);

    if (perm !== 'granted') {
      addLog('❌ Permissão negada. Ative nas configurações do navegador.');
      return;
    }

    addLog('✅ Permissão concedida. Registrando service worker...');

    try {
      const { solicitarPermissao } = await import('@/lib/notifications');
      const token = await solicitarPermissao();

      if (token) {
        addLog(`✅ Token FCM obtido: ${token.slice(0, 20)}...`);
        addLog('Token salvo no perfil do Supabase.');
      } else {
        addLog('❌ Não foi possível obter token FCM. Verifique VAPID key e config do Firebase.');
      }
    } catch (err) {
      addLog(`❌ Erro ao registrar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function enviarTeste() {
    const texto = mensagem.trim();
    if (!texto) {
      addLog('⚠️ Digite uma mensagem primeiro.');
      return;
    }

    setEnviando(true);
    addLog(`Enviando push: "${texto}"...`);

    try {
      const res = await fetch('/api/notificacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'conquista',
          titulo: '🔔 Teste de Notificação',
          mensagem: texto,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        addLog(`❌ Erro ${res.status}: ${data.error || JSON.stringify(data)}`);
      } else if (data.enviado === false) {
        addLog(`⚠️ Não enviado: ${data.motivo || 'sem token FCM no perfil'}`);
      } else {
        addLog(`✅ Push enviado com sucesso! Resposta: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      addLog(`❌ Erro de rede: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEnviando(false);
    }
  }

  async function testarLocal() {
    const texto = mensagem.trim() || 'Teste local do Maestro';
    addLog(`Enviando notificação local: "${texto}"...`);

    try {
      if (Notification.permission !== 'granted') {
        addLog('❌ Permissão não concedida. Clique em "Ativar Permissão" primeiro.');
        return;
      }
      new Notification('🔔 Teste Local', { body: texto, icon: '/icon-192.png' });
      addLog('✅ Notificação local exibida.');
    } catch (err) {
      addLog(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Teste de Notificações</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Página temporária para depurar push notifications.
      </p>

      {/* Passo 1 */}
      <div className="mb-6 rounded-lg border p-4 dark:border-gray-700">
        <h2 className="mb-2 font-semibold">1. Ativar permissão + registrar token</h2>
        <button
          onClick={pedirPermissao}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Ativar Permissão
        </button>
      </div>

      {/* Passo 2 */}
      <div className="mb-6 rounded-lg border p-4 dark:border-gray-700">
        <h2 className="mb-2 font-semibold">2. Enviar notificação de teste</h2>
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Digite a mensagem da notificação..."
          rows={3}
          className="mb-3 w-full rounded border p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <div className="flex gap-3">
          <button
            onClick={enviarTeste}
            disabled={enviando}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar Push (servidor)'}
          </button>
          <button
            onClick={testarLocal}
            className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
          >
            Testar Local (sem servidor)
          </button>
        </div>
      </div>

      {/* Log */}
      <div className="rounded-lg border p-4 dark:border-gray-700">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Log</h2>
          <button
            onClick={() => setLog([])}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Limpar
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto rounded bg-gray-100 p-3 font-mono text-xs dark:bg-gray-900">
          {log.length === 0 ? (
            <span className="text-gray-400">Nenhum log ainda...</span>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="mb-1 whitespace-pre-wrap">
                {entry}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
