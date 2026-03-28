// Middleware — protege rotas autenticadas e redireciona conforme sessão
//
// ⚠️  Proteção de rota desativada temporariamente enquanto o dashboard usa dados mock.
//     Para ativar: descomente o bloco de redirect abaixo.

import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Se Supabase não está configurado, deixa passar todas as rotas (modo dev/mock)
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  // --- Auth habilitado (Supabase configurado) ---
  const { createServerClient } = await import('@supabase/ssr');

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // TODO: Reativar quando a autenticação estiver integrada ao dashboard
  // Usuário NÃO autenticado tentando acessar rotas protegidas → redireciona para /login
  // if (!user && pathname.startsWith('/dashboard')) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }

  // Usuário autenticado tentando acessar /login → redireciona para /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
