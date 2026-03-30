// Serviço de notificações — push notifications via Firebase Cloud Messaging

import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';
import { createBrowserClient } from '@supabase/ssr';

// ---------------------------------------------------------------------------
// Supabase client (browser)
// ---------------------------------------------------------------------------

function criarSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ---------------------------------------------------------------------------
// Pedir permissão + obter token FCM
// ---------------------------------------------------------------------------

/**
 * Solicita permissão de notificação ao usuário.
 * Se autorizado, obtém o FCM token e o salva no perfil do usuário.
 * Retorna o token ou null se negado/não suportado.
 */
export async function solicitarPermissao(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error('Firebase Messaging não suportado neste navegador.');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error(`Permissão negada: ${permission}`);
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error('NEXT_PUBLIC_FIREBASE_VAPID_KEY não está configurada no deploy.');
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '';
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '';

  if (!apiKey || !projectId || !messagingSenderId || !appId) {
    throw new Error(
      `Firebase config incompleta: apiKey=${apiKey ? 'OK' : 'VAZIO'}, projectId=${projectId ? 'OK' : 'VAZIO'}, senderId=${messagingSenderId ? 'OK' : 'VAZIO'}, appId=${appId ? 'OK' : 'VAZIO'}`,
    );
  }

  const swConfig = new URLSearchParams({ apiKey, projectId, messagingSenderId, appId });

  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${swConfig.toString()}`,
  );

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error('getToken() retornou vazio. Possível: VAPID key incorreta ou projeto Firebase sem Cloud Messaging ativado.');
  }

  await salvarToken(token);
  return token;
}

// ---------------------------------------------------------------------------
// Salvar token no Supabase (tabela profiles)
// ---------------------------------------------------------------------------

/**
 * Salva o FCM token via API server-side para evitar race conditions.
 */
export async function salvarToken(token: string): Promise<{ tokensBefore: number; tokensAfter: number; novoTokenSalvo: boolean }> {
  const res = await fetch('/api/notificacoes/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[FCM] Erro ao salvar token via API:', data.error);
    throw new Error(`Erro ao salvar token: ${data.error}`);
  }

  console.log(`[FCM] Token salvo: antes=${data.tokensBefore}, depois=${data.tokensAfter}, salvo=${data.novoTokenSalvo}`);
  return { tokensBefore: data.tokensBefore, tokensAfter: data.tokensAfter, novoTokenSalvo: data.novoTokenSalvo };
}

// ---------------------------------------------------------------------------
// Listener de mensagens em foreground
// ---------------------------------------------------------------------------

/**
 * Registra um handler para notificações recebidas com o app em foreground.
 * Retorna uma função para cancelar o listener.
 */
export async function ouvirNotificacoes(
  handler: (titulo: string, corpo: string) => void,
): Promise<() => void> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};

  const unsubscribe = onMessage(messaging, (payload) => {
    const titulo = payload.notification?.title ?? 'Maestro';
    const corpo = payload.notification?.body ?? '📚 Hora de estudar!';
    handler(titulo, corpo);
  });

  return unsubscribe;
}

// ---------------------------------------------------------------------------
// Enviar notificação local (para testes / fallback)
// ---------------------------------------------------------------------------

/**
 * Exibe uma notificação local usando a Notifications API (sem FCM).
 * Útil para testes ou lembretes programados no client.
 */
export async function enviarNotificacaoLocal(
  titulo: string,
  corpo: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }

  new Notification(titulo, {
    body: corpo,
    icon: '/icon-192.png',
  });
}

// ---------------------------------------------------------------------------
// Agendar lembrete diário
// ---------------------------------------------------------------------------

/**
 * Agenda uma notificação local para um horário específico do dia.
 * Armazena o timeout em sessionStorage para não duplicar.
 * @param hora Hora do dia (0-23)
 * @param minuto Minuto (0-59)
 */
export function agendarLembreteDiario(hora: number, minuto: number): void {
  if (typeof window === 'undefined') return;

  // Limpa agendamento anterior
  const prevId = sessionStorage.getItem('maestro_lembrete_id');
  if (prevId) clearTimeout(Number(prevId));

  const agora = new Date();
  const alvo = new Date();
  alvo.setHours(hora, minuto, 0, 0);
  if (alvo <= agora) alvo.setDate(alvo.getDate() + 1); // próximo dia

  const ms = alvo.getTime() - agora.getTime();
  const id = setTimeout(() => {
    enviarNotificacaoLocal(
      '📚 Hora de estudar!',
      'Você tem cards para revisar hoje. Manter o ritmo faz toda a diferença!',
    );
    // Re-agenda para o próximo dia
    agendarLembreteDiario(hora, minuto);
  }, ms);

  sessionStorage.setItem('maestro_lembrete_id', String(id));
}

// ---------------------------------------------------------------------------
// Notificar missão completa (chama servidor)
// ---------------------------------------------------------------------------

/**
 * Dispara notificação push de missão concluída via /api/notificacoes.
 * Deve ser chamada no client após receber confirmação de missão completa.
 */
export async function notificarMissaoCompleta(
  tituloMissao: string,
  xpGanho: number,
): Promise<void> {
  try {
    await fetch('/api/notificacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'missao_completa',
        titulo: tituloMissao,
        xp: xpGanho,
      }),
    });
  } catch {
    // silently fail — notificação não é crítica
  }
}

// ---------------------------------------------------------------------------
// Notificar conquista desbloqueada (chama servidor)
// ---------------------------------------------------------------------------

/**
 * Dispara notificação push de conquista via /api/notificacoes.
 */
export async function notificarConquista(
  titulo: string,
  mensagem: string,
): Promise<void> {
  try {
    await fetch('/api/notificacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'conquista', titulo, mensagem }),
    });
  } catch {
    // silently fail
  }
}
