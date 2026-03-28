// Hook useStreak — rastreamento de dias consecutivos de estudo e cálculo de streak

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Streak } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface UseStreakRetorno {
  /** Número de dias consecutivos estudados até hoje */
  diasConsecutivos: number;
  /** Se a meta diária foi atingida no dia mais recente registrado */
  metaAtingida: boolean;
  /** Data ISO do último registro de atividade (null se não houver histórico) */
  ultimoRegistro: string | null;
  /** Marca hoje como dia ativo no Supabase e recalcula o streak */
  registrarAtividade: (metaAtingida?: boolean) => Promise<void>;
  /** Indica que a busca inicial ainda está em andamento */
  carregando: boolean;
  /** Mensagem de erro caso alguma operação no Supabase falhe */
  erro: string | null;
}

/**
 * Conta quantos dias consecutivos existem no histórico de streaks,
 * começando pela data mais recente e retrocedendo dia a dia.
 */
function calcularDiasConsecutivos(registros: Streak[]): number {
  if (registros.length === 0) return 0;

  // Ordena do mais recente para o mais antigo
  const datas = registros
    .map((r) => r.data)
    .sort((a, b) => b.localeCompare(a));

  const hoje = new Date().toISOString().split('T')[0];

  // O streak só conta se o registro mais recente é hoje ou ontem
  const maisRecente = datas[0];
  const diffInicio = diffDias(maisRecente, hoje);
  if (diffInicio > 1) return 0;

  let consecutivos = 1;

  for (let i = 1; i < datas.length; i++) {
    const diff = diffDias(datas[i], datas[i - 1]);
    if (diff === 1) {
      consecutivos++;
    } else {
      break; // sequência quebrada
    }
  }

  return consecutivos;
}

/** Retorna a diferença em dias inteiros entre duas datas ISO (YYYY-MM-DD) */
function diffDias(anterior: string, posterior: string): number {
  const msPerDia = 86_400_000;
  return Math.round(
    (new Date(posterior).getTime() - new Date(anterior).getTime()) / msPerDia,
  );
}

/**
 * Gerencia o streak diário do usuário buscando e gravando dados no Supabase.
 */
export function useStreak(): UseStreakRetorno {
  const [registros, setRegistros] = useState<Streak[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Busca todo o histórico de streak do usuário autenticado
  useEffect(() => {
    let cancelado = false;

    async function buscarStreak() {
      setCarregando(true);
      setErro(null);

      try {
        const supabase = createClient();

        const { data: usuario, error: erroAuth } =
          await supabase.auth.getUser();

        if (erroAuth || !usuario.user) {
          if (!cancelado) setErro('Usuário não autenticado.');
          return;
        }

        const { data, error: erroBusca } = await supabase
          .from('streak')
          .select('*')
          .eq('user_id', usuario.user.id)
          .order('data', { ascending: false });

        if (erroBusca) throw new Error(erroBusca.message);

        if (!cancelado) {
          // Normaliza snake_case → camelCase conforme o tipo Streak
          const normalizados: Streak[] = (data ?? []).map((r) => ({
            id: r.id,
            userId: r.user_id,
            data: r.data,
            metaAtingida: r.meta_atingida,
          }));
          setRegistros(normalizados);
        }
      } catch (e) {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : 'Erro ao buscar streak.');
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    buscarStreak();
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Registra a atividade do dia atual.
   * - Se já existe um registro para hoje, atualiza `meta_atingida`.
   * - Caso contrário, insere um novo registro (upsert pela coluna `data`).
   */
  const registrarAtividade = useCallback(
    async (metaAtingidaParam = false): Promise<void> => {
      setErro(null);

      try {
        const supabase = createClient();

        const { data: usuarioData, error: erroAuth } =
          await supabase.auth.getUser();

        if (erroAuth || !usuarioData.user) {
          setErro('Usuário não autenticado.');
          return;
        }

        const hoje = new Date().toISOString().split('T')[0];
        const userId = usuarioData.user.id;

        const { data, error: erroUpsert } = await supabase
          .from('streak')
          .upsert(
            {
              user_id: userId,
              data: hoje,
              meta_atingida: metaAtingidaParam,
            },
            { onConflict: 'user_id,data' },
          )
          .select()
          .single();

        if (erroUpsert) throw new Error(erroUpsert.message);

        const novoRegistro: Streak = {
          id: data.id,
          userId: data.user_id,
          data: data.data,
          metaAtingida: data.meta_atingida,
        };

        // Atualiza o estado local sem refazer o fetch completo
        setRegistros((prev) => {
          const semHoje = prev.filter((r) => r.data !== hoje);
          return [novoRegistro, ...semHoje].sort((a, b) =>
            b.data.localeCompare(a.data),
          );
        });
      } catch (e) {
        setErro(
          e instanceof Error ? e.message : 'Erro ao registrar atividade.',
        );
      }
    },
    [],
  );

  const diasConsecutivos = calcularDiasConsecutivos(registros);
  const ultimoRegistro = registros[0]?.data ?? null;
  const metaAtingida = registros[0]?.metaAtingida ?? false;

  return {
    diasConsecutivos,
    metaAtingida,
    ultimoRegistro,
    registrarAtividade,
    carregando,
    erro,
  };
}
