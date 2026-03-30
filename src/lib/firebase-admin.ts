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
): Promise<{ sucesso: number; falha: number; tokensInvalidos: string[] }> {
  if (tokens.length === 0) return { sucesso: 0, falha: 0, tokensInvalidos: [] };

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

    // Coletar tokens inválidos para limpeza
    const tokensInvalidos: string[] = [];
    resposta.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code ?? '';
        const msg = r.error?.message?.toLowerCase() ?? '';
        if (code.includes('not-registered') || msg.includes('notregistered') || msg.includes('not registered')) {
          tokensInvalidos.push(tokens[i]);
        }
      }
    });

    return {
      sucesso: resposta.successCount,
      falha: resposta.failureCount,
      tokensInvalidos,
    };
  } catch (err) {
    console.error('[FCM Admin] Erro ao enviar push múltiplo:', err);
    return { sucesso: 0, falha: tokens.length, tokensInvalidos: [] };
  }
}

// ---------------------------------------------------------------------------
// Helpers para tokens multi-dispositivo
// ---------------------------------------------------------------------------

/**
 * Parseia o campo fcm_token que pode ser uma string simples ou JSON array.
 */
export function parseTokens(fcmToken: string | null | undefined): string[] {
  if (!fcmToken) return [];
  try {
    const parsed = JSON.parse(fcmToken);
    if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === 'string' && t.length > 0);
    return [fcmToken];
  } catch {
    return fcmToken.length > 0 ? [fcmToken] : [];
  }
}

/**
 * Envia push para todos os tokens de um usuário (multi-dispositivo).
 * Retorna resultado agregado.
 */
export async function enviarPushParaUsuario(
  tokens: string[],
  titulo: string,
  corpo: string,
  url?: string,
): Promise<{ ok: boolean; enviados: number; falhas: number; messageIds: string[]; erros: string[]; tokensInvalidos: string[] }> {
  if (tokens.length === 0) {
    return { ok: false, enviados: 0, falhas: 0, messageIds: [], erros: ['Sem tokens'], tokensInvalidos: [] };
  }

  const messageIds: string[] = [];
  const erros: string[] = [];
  const tokensInvalidos: string[] = [];
  let enviados = 0;
  let falhas = 0;

  for (const token of tokens) {
    const resultado = await enviarPush({ token, titulo, corpo, url });
    if (resultado.ok) {
      enviados++;
      if (resultado.messageId) messageIds.push(resultado.messageId);
    } else {
      falhas++;
      if (resultado.erro) erros.push(resultado.erro);
      const erroLower = resultado.erro?.toLowerCase() ?? '';
      if (erroLower.includes('notregistered') || erroLower.includes('not-registered') || erroLower.includes('not registered') || erroLower.includes('invalid-registration-token') || erroLower.includes('invalid registration')) {
        tokensInvalidos.push(token);
      }
    }
  }

  return { ok: enviados > 0, enviados, falhas, messageIds, erros, tokensInvalidos };
}
