'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const SEQUENCIA = [
  '/dashboard',
  '/dashboard/baralhos',
  '/dashboard/progresso',
  '/dashboard/perfil',
];

const COOLDOWN_MS = 2 * 60 * 1000;
const STORAGE_CHAVE_ULTIMO_DISPARO = 'maestro_secreto_ultimo_disparo';

export default function AtalhoSecretoNotificacao() {
  const pathname = usePathname();
  const etapaRef = useRef(0);

  useEffect(() => {
    if (!pathname) return;

    const etapaAtual = etapaRef.current;

    // Continua a sequência quando o caminho esperado bate.
    if (pathname === SEQUENCIA[etapaAtual]) {
      etapaRef.current += 1;

      if (etapaRef.current === SEQUENCIA.length) {
        etapaRef.current = 0;
        void dispararBroadcastSecreto();
      }

      return;
    }

    // Se voltou para o início, reinicia na primeira etapa.
    if (pathname === SEQUENCIA[0]) {
      etapaRef.current = 1;
      return;
    }

    // Qualquer outro caminho quebra a sequência.
    etapaRef.current = 0;
  }, [pathname]);

  return null;
}

async function dispararBroadcastSecreto() {
  try {
    const ultimo = Number(localStorage.getItem(STORAGE_CHAVE_ULTIMO_DISPARO) ?? '0');
    const agora = Date.now();

    if (agora - ultimo < COOLDOWN_MS) return;

    const res = await fetch('/api/notificacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'broadcast',
        titulo: '💌 Lembrete especial',
        mensagem: 'cuida amor, estudar, sai do tik tok ❤️',
      }),
    });

    if (res.ok) {
      localStorage.setItem(STORAGE_CHAVE_ULTIMO_DISPARO, String(agora));
    }
  } catch {
    // Atalho secreto não deve quebrar a navegação.
  }
}
