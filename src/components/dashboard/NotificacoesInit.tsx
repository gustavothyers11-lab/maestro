// Componente client-side que inicializa notificações FCM no primeiro acesso do dia
// e dispara push de streak quando aplicável

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

const STORAGE_KEY_FCM = 'maestro_fcm_init';
const STORAGE_KEY_STREAK = 'maestro_streak_notif';

export default function NotificacoesInit() {
  useEffect(() => {
    async function init() {
      // Só executa uma vez por dia
      const hoje = new Date().toDateString();
      const ultimaInit = localStorage.getItem(STORAGE_KEY_FCM);
      if (ultimaInit === hoje) return;

      const supabase = criarSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Solicitar permissão e salvar token FCM
      try {
        await solicitarPermissao();
      } catch {
        // not blocking
      }

      // Agendar lembrete diário às 20h
      agendarLembreteDiario(20, 0);

      localStorage.setItem(STORAGE_KEY_FCM, hoje);

      // Verificar streak e disparar notificação nos marcos
      verificarStreak(user.id, supabase);
    }

    init();
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
