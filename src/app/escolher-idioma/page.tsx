// Página de seleção de idioma — exibida após primeiro login

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const IDIOMAS = [
  { nome: 'Espanhol', codigo: 'es', bandeira: '🇪🇸' },
  { nome: 'Inglês', codigo: 'en', bandeira: '🇺🇸' },
  { nome: 'Francês', codigo: 'fr', bandeira: '🇫🇷' },
  { nome: 'Italiano', codigo: 'it', bandeira: '🇮🇹' },
  { nome: 'Alemão', codigo: 'de', bandeira: '🇩🇪' },
  { nome: 'Japonês', codigo: 'ja', bandeira: '🇯🇵' },
  { nome: 'Coreano', codigo: 'ko', bandeira: '🇰🇷' },
  { nome: 'Mandarim', codigo: 'zh', bandeira: '🇨🇳' },
] as const;

export default function EscolherIdiomaPage() {
  const router = useRouter();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = useCallback(async () => {
    if (!selecionado) return;
    setSalvando(true);
    setErro('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');

      const { error } = await supabase
        .from('profiles')
        .update({ idioma: selecionado })
        .eq('id', user.id);

      if (error) throw new Error('Erro ao salvar idioma.');
      router.push('/dashboard');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
      setSalvando(false);
    }
  }, [selecionado, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0f0f1a] px-4">
      {/* Glow decorativo */}
      <div aria-hidden="true" className="pointer-events-none absolute top-1/4 left-1/3 h-80 w-80 rounded-full bg-[#1260CC]/15 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-1/4 right-1/3 h-72 w-72 rounded-full bg-[#0ABFDE]/12 blur-[110px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-[#1260CC] to-[#0ABFDE] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
            Maestro
          </h1>
          <p className="mt-3 text-lg font-semibold text-white">
            Qual idioma você quer estudar?
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Você pode mudar depois no perfil.
          </p>
        </div>

        {/* Grid de idiomas */}
        <div className="grid grid-cols-2 gap-3">
          {IDIOMAS.map((idioma) => {
            const ativo = selecionado === idioma.nome;
            return (
              <button
                key={idioma.codigo}
                type="button"
                onClick={() => setSelecionado(idioma.nome)}
                className={[
                  'relative flex flex-col items-center gap-2 rounded-xl border p-5 transition-all duration-200',
                  ativo
                    ? 'border-[#0ABFDE] bg-[#0ABFDE]/10 shadow-lg shadow-[#0ABFDE]/20 scale-[1.03]'
                    : 'border-white/10 bg-[#1a1a2e] hover:border-white/20 hover:bg-[#1a1a2e]/80',
                ].join(' ')}
              >
                <span className="text-3xl">{idioma.bandeira}</span>
                <span className={[
                  'text-sm font-bold',
                  ativo ? 'text-[#0ABFDE]' : 'text-white/70',
                ].join(' ')}>
                  {idioma.nome}
                </span>
                {ativo && (
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0ABFDE] text-[10px] text-white">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Erro */}
        {erro && (
          <p className="mt-4 text-center text-sm text-red-400">{erro}</p>
        )}

        {/* Botão confirmar */}
        <button
          type="button"
          onClick={salvar}
          disabled={!selecionado || salvando}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#1260CC] to-[#0ABFDE] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#1260CC]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
        >
          {salvando ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Salvando…
            </span>
          ) : (
            'Começar a estudar'
          )}
        </button>
      </div>
    </div>
  );
}
