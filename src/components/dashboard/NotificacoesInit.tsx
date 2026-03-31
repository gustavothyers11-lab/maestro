'use client';

import { useEffect } from 'react';
import { solicitarPermissao, agendarLembreteDiario } from '@/lib/notifications';
import { createBrowserClient } from '@supabase/ssr';

function criarSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const STORAGE_KEY_STREAK = 'maestro_streak_notif';

export default function NotificacoesInit() {
  useEffect(() => {
    async function init() {
      const supabase = criarSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Sempre forçar novo token (deleta antigo + registra novo)
      try {
        await solicitarPermissao();
      } catch {
        // not blocking
      }

      agendarLembreteDiario(20, 0);
      verificarStreak(user.id, supabase);
    }

    init();

    // Handler de notificações em foreground (app aberto)
    let unsubscribe: (() => void) | null = null;
    import('@/lib/notifications').then(async ({ ouvirNotificacoes }) => {
      unsubscribe = await ouvirNotificacoes((titulo, corpo) => {
        console.log('[NotificacoesInit] onMessage foreground:', titulo, corpo);
        if (Notification.permission === 'granted') {
          try {
            // Desktop: new Notification() funciona melhor em foreground
            new Notification(titulo, { body: corpo, icon: '/icon-192.png' });
          } catch {
            // PWA/mobile: fallback para SW
            navigator.serviceWorker?.ready.then((reg) => {
              reg.showNotification(titulo, { body: corpo, icon: '/icon-192.png' });
            });
          }
        }
      });
      console.log('[NotificacoesInit] onMessage listener registrado');
    }).catch((err) => {
      console.error('[NotificacoesInit] Erro ao registrar onMessage:', err);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return null;
}

async function verificarStreak(
  userId: string,
  supabase: ReturnType<typeof criarSupabase>,
) {
  try {
    const { data: streakData } = await supabase
      .from('streak')
      .select('meta_atingida')
      .eq('user_id', userId)
      .order('data', { ascending: false })
      .limit(100);

    if (!streakData) return;

    let streak = 0;
    for (const s of streakData) {
      if (s.meta_atingida) streak++;
      else break;
    }

    if (streak === 0) return;

    // Marcos que disparam notificação
    const marcos = [7, 14, 30, 60, 100];
    if (!marcos.includes(streak)) return;

    // Verifica se já notificou este marco
    const chave = `${STORAGE_KEY_STREAK}_${streak}`;
    if (localStorage.getItem(chave)) return;

    await fetch('/api/notificacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'streak', dias: streak }),
    });

    localStorage.setItem(chave, '1');
  } catch {
    // silently fail
  }
}
