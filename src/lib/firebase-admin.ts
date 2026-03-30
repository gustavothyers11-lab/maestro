// Firebase Admin — singleton para uso server-side (API routes)
// As credenciais vêm de variáveis de ambiente para não expor secrets

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

let adminApp: App;
let adminMessaging: Messaging;

function initAdmin(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Variáveis de ambiente Firebase Admin não configuradas: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY',
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getAdminMessaging(): Messaging {
  if (!adminMessaging) {
    adminApp = initAdmin();
    adminMessaging = getMessaging(adminApp);
  }
  return adminMessaging;
}

// ---------------------------------------------------------------------------
// Helpers para envio de push
// ---------------------------------------------------------------------------

export interface PushPayload {
  token: string;
  titulo: string;
  corpo: string;
  data?: Record<string, string>;
  url?: string;
}

/**
 * Envia uma notificação push para um token FCM específico.
 * Retorna true se enviado com sucesso.
 */
export async function enviarPush(payload: PushPayload): Promise<{ ok: boolean; erro?: string; messageId?: string }> {
  try {
    const messaging = getAdminMessaging();
    const messageId = await messaging.send({
      token: payload.token,
      notification: {
        title: payload.titulo,
        body: payload.corpo,
      },
      webpush: {
        fcmOptions: {
          link: payload.url ?? '/dashboard',
        },
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          requireInteraction: false,
        },
      },
      data: payload.data,
    });
    return { ok: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[FCM Admin] Erro ao enviar push:', msg);
    return { ok: false, erro: msg };
  }
}

/**
 * Envia um push para múltiplos tokens (max 500 por chamada — limite FCM).
 * Retorna contagem de sucesso/falha.
 */
export async function enviarPushMultiplo(
  tokens: string[],
  titulo: string,
  corpo: string,
  url?: string,
): Promise<{ sucesso: number; falha: number }> {
  if (tokens.length === 0) return { sucesso: 0, falha: 0 };

  try {
    const messaging = getAdminMessaging();
    const resposta = await messaging.sendEachForMulticast({
      tokens: tokens.slice(0, 500),
      notification: { title: titulo, body: corpo },
      webpush: {
        fcmOptions: { link: url ?? '/dashboard' },
        notification: { icon: '/icon-192.png', badge: '/icon-72.png' },
      },
    });

    return {
      sucesso: resposta.successCount,
      falha: resposta.failureCount,
    };
  } catch (err) {
    console.error('[FCM Admin] Erro ao enviar push múltiplo:', err);
    return { sucesso: 0, falha: tokens.length };
  }
}
