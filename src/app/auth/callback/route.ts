// Callback OAuth — troca o code por sessão e redireciona para o dashboard

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(`${origin}/login?error=auth_config`);
  }

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Verifica se o usuário já escolheu um idioma
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('idioma')
          .eq('id', user.id)
          .single();

        if (!profile?.idioma) {
          return NextResponse.redirect(`${origin}/escolher-idioma`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Fallback: redireciona para login em caso de erro
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
