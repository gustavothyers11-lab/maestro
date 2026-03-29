// Página de login — autenticação do usuário via Supabase Auth

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Partículas geométricas de fundo (puramente decorativas)
// ---------------------------------------------------------------------------

const particulas = [
  { x: '10%', y: '20%', size: 6, delay: '0s', dur: '6s' },
  { x: '25%', y: '65%', size: 4, delay: '1s', dur: '8s' },
  { x: '70%', y: '15%', size: 5, delay: '2s', dur: '7s' },
  { x: '80%', y: '70%', size: 7, delay: '0.5s', dur: '9s' },
  { x: '50%', y: '40%', size: 3, delay: '3s', dur: '10s' },
  { x: '15%', y: '80%', size: 5, delay: '1.5s', dur: '7.5s' },
  { x: '90%', y: '45%', size: 4, delay: '2.5s', dur: '6.5s' },
  { x: '40%', y: '85%', size: 6, delay: '0.8s', dur: '8.5s' },
];

function Particulas() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {particulas.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-sm bg-white/[0.04] animate-[float_var(--dur)_ease-in-out_var(--delay)_infinite_alternate]"
          style={
            {
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              '--delay': p.delay,
              '--dur': p.dur,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ícone do Google (SVG inline)
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.01 24.01 0 000 21.56l7.98-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get('error');

    if (errorCode === 'auth_callback') {
      setErro('Falha ao concluir o login. Verifique as URLs de redirecionamento do Supabase e tente novamente.');
      return;
    }

    if (errorCode === 'auth_config') {
      setErro('A autenticacao nao esta configurada corretamente no deploy.');
      return;
    }

    setErro(null);
  }, []);

  async function handleLoginGoogle() {
    setCarregando(true);
    setErro(null);

    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || window.location.origin;
    const redirectTo = new URL('/auth/callback?next=/dashboard', siteUrl).toString();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      setErro('Falha ao conectar com Google. Tente novamente.');
      setCarregando(false);
      return;
    }

    if (!data?.url) {
      setErro('Falha ao iniciar o login.');
      setCarregando(false);
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0f0f1a] px-4">
      {/* Partículas geométricas */}
      <Particulas />

      {/* Card central */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + subtítulo */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-[#1260CC] to-[#0ABFDE] bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
            Maestro
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Aprenda espanhol como um jogo
          </p>
        </div>

        {/* Card com borda gradiente */}
        <div className="relative overflow-hidden rounded-xl bg-[#1a1a2e] p-6 shadow-2xl shadow-primary/10">
          {/* Borda gradiente */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-[#1260CC] to-[#0ABFDE]"
            style={{
              WebkitMask:
                'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1.5px',
            }}
          />

          {/* Brilho superior */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />

          <div className="relative flex flex-col gap-5">
            <p className="text-center text-sm text-gray-300">
              Entre para começar sua jornada
            </p>

            {/* Botão Google */}
            <button
              type="button"
              onClick={handleLoginGoogle}
              disabled={carregando}
              className={[
                'group relative flex w-full items-center justify-center gap-3',
                'rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-800',
                'transition-all duration-150',
                'hover:shadow-lg hover:shadow-[#1260CC]/20',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1260CC]/50',
                'disabled:opacity-50 disabled:pointer-events-none',
              ].join(' ')}
            >
              {/* Brilho hover */}
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#1260CC]/0 via-[#1260CC]/5 to-[#0ABFDE]/0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              />

              {carregando ? (
                <svg
                  className="h-5 w-5 animate-spin text-gray-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <GoogleIcon />
              )}
              <span className="relative">Entrar com Google</span>
            </button>

            {/* Erro */}
            {erro && (
              <p className="text-center text-xs text-red-400" role="alert">
                {erro}
              </p>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <p className="mt-6 text-center text-xs text-gray-600">
          Ao entrar, você aceita nossos termos de uso.
        </p>
      </div>
    </div>
  );
}
