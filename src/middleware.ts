import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Proteção de rotas por papel (RBAC). Verifica o JWT de sessão no edge e
 * redireciona conforme o tipo de conta. A autorização fina (dono do recurso)
 * é reforçada nas server actions.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isTrabalhadorArea = pathname.startsWith("/trabalhador");
  const isEmpresaArea = pathname.startsWith("/empresa");

  if (!session) {
    const tipo = isEmpresaArea ? "EMPRESA" : "TRABALHADOR";
    const url = new URL(`/login?tipo=${tipo}&next=${encodeURIComponent(pathname)}`, req.url);
    return NextResponse.redirect(url);
  }

  if (isTrabalhadorArea && session.tipo !== "TRABALHADOR") {
    return NextResponse.redirect(new URL("/empresa/eventos", req.url));
  }
  if (isEmpresaArea && session.tipo !== "EMPRESA") {
    return NextResponse.redirect(new URL("/trabalhador/eventos", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/trabalhador/:path*", "/empresa/:path*"],
};
