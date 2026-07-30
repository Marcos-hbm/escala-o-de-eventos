import "server-only";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getSession, type SessionPayload, type TipoConta } from "./session";
import { checarPermissao, pode, type PapelId, type Permissao } from "./rbac";

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/**
 * Valida credenciais contra a tabela correta conforme o tipo selecionado.
 * Retorna o payload de sessão ou null (mensagem genérica evita enumeração
 * de contas). Contas anonimizadas/inativas (LGPD) não autenticam.
 *
 * v3 (SaaS): login de empresa resolve por `membros` — cada empresa tem ao menos
 * um membro PROPRIETARIO com as credenciais da conta (criado no cadastro e no
 * backfill da migration). A sessão aponta para a EMPRESA (tenant) e carrega o
 * membro + papel.
 */
export async function verificarCredenciais(
  tipo: TipoConta,
  email: string,
  senha: string,
): Promise<SessionPayload | null> {
  if (tipo === "TRABALHADOR") {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo || user.anonimizadoEm) return null;
    if (!(await conferirSenha(senha, user.senhaHash))) return null;
    return { sub: user.id, tipo, nome: user.nome, email: user.email };
  } else {
    const membro = await prisma.membro.findUnique({
      where: { email },
      include: { empresa: { select: { id: true, nome: true, ativo: true, anonimizadoEm: true } } },
    });
    if (!membro || !membro.ativo) return null;
    if (!membro.empresa.ativo || membro.empresa.anonimizadoEm) return null;
    if (!(await conferirSenha(senha, membro.senhaHash))) return null;
    return {
      sub: membro.empresa.id,
      tipo,
      nome: membro.empresa.nome,
      email: membro.email,
      membroId: membro.id,
      papel: membro.papel,
      membroNome: membro.nome,
    };
  }
}

/** Sessão atual (ou null). */
export async function getAtor(): Promise<SessionPayload | null> {
  return getSession();
}

/** Exige um trabalhador autenticado; redireciona caso contrário. */
export async function requireTrabalhador(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) redirect("/login?tipo=TRABALHADOR");
  if (s.tipo !== "TRABALHADOR") redirect("/empresa/eventos");
  return s;
}

/**
 * Exige uma empresa autenticada; redireciona caso contrário.
 *
 * Além do tipo de conta, revalida o membro no banco: se ele foi desativado (ou
 * removido) durante a validade do token, o acesso cai no próximo request — sem
 * isso, um acesso revogado sobreviveria até o JWT expirar (8h).
 */
export async function requireEmpresa(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) redirect("/login?tipo=EMPRESA");
  if (s.tipo !== "EMPRESA") redirect("/trabalhador/eventos");

  if (s.membroId != null) {
    const membro = await prisma.membro.findUnique({
      where: { id: s.membroId },
      select: { ativo: true, papel: true, empresaId: true },
    });
    if (!membro || !membro.ativo || membro.empresaId !== s.sub) {
      // O cookie não é apagado aqui: em Server Components o Next 15 não permite
      // mutar cookies durante o render. Ele deixa de valer de qualquer forma —
      // toda tela da empresa revalida o membro — e o próximo login o substitui.
      redirect("/login?tipo=EMPRESA&erro=acesso_revogado");
    }
    // O papel vale o que está no banco (troca de papel tem efeito imediato).
    return { ...s, papel: membro.papel };
  }
  return s;
}

/**
 * Papel efetivo da sessão. Sessões emitidas antes da v3 não têm `papel`: eram
 * necessariamente o dono da conta (usuário único da empresa), então valem como
 * PROPRIETARIO até expirarem.
 */
export function papelDaSessao(s: SessionPayload): PapelId {
  return s.papel ?? "PROPRIETARIO";
}

/** Atalho de leitura para páginas/UI. */
export function sessaoPode(s: SessionPayload, permissao: Permissao): boolean {
  return s.tipo === "EMPRESA" && pode(papelDaSessao(s), permissao);
}

/**
 * Para server actions: `null` quando autorizado, mensagem pronta (com o papel
 * necessário) quando negado.
 */
export function erroDePermissao(s: SessionPayload, permissao: Permissao): string | null {
  return checarPermissao(papelDaSessao(s), permissao);
}

/**
 * Para páginas: exige empresa + permissão. Sem permissão, volta ao painel com
 * o motivo na query (a página de destino exibe o aviso).
 */
export async function requirePermissao(permissao: Permissao): Promise<SessionPayload> {
  const s = await requireEmpresa();
  if (!sessaoPode(s, permissao)) {
    redirect(`/empresa/dashboard?negado=${encodeURIComponent(permissao)}`);
  }
  return s;
}
