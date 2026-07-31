import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ORDEM_PAPEIS, type PapelId } from "./rbac";

/**
 * Camada de sessão no padrão credentials + JWT (mesma abordagem que o
 * Auth.js adota internamente com `jose`). O token é assinado com AUTH_SECRET
 * e guardado em cookie httpOnly/SameSite=Lax — não acessível a JavaScript do
 * cliente, mitigando XSS (RNF03 Segurança de Dados).
 *
 * Duas naturezas de conta (TRABALHADOR e EMPRESA) vivem em tabelas distintas
 * (dicionário de dados do TCC), por isso o `tipo` faz parte do payload e é a
 * base do controle de acesso por papel (RBAC).
 *
 * v3 (SaaS): para contas EMPRESA, `sub` continua sendo o **id da empresa** (o
 * tenant que escopa todos os dados), e o membro autenticado viaja em
 * `membroId`/`papel`/`membroNome`. Assim as consultas existentes (`empresaId:
 * s.sub`) seguem valendo e ganhamos multiusuário com papéis.
 */

export const SESSION_COOKIE = "escala_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 horas

export type TipoConta = "TRABALHADOR" | "EMPRESA";

export interface SessionPayload {
  sub: number; // id do trabalhador (users) ou da empresa (empresas = tenant)
  tipo: TipoConta;
  nome: string; // nome do trabalhador ou razão social da empresa
  email: string; // e-mail usado no login (do membro, quando EMPRESA)
  // --- Somente para tipo EMPRESA (v3 SaaS) ---
  membroId?: number;
  papel?: PapelId;
  membroNome?: string;
  /// v4 — "coordenador autorizado" do financeiro (`Membro.autorizadoFinanceiro`).
  financeiro?: boolean;
}

function ehPapel(v: unknown): v is PapelId {
  return typeof v === "string" && (ORDEM_PAPEIS as string[]).includes(v);
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente ou fraco. Defina AUTH_SECRET (>= 32 caracteres) no .env. Gere com: openssl rand -base64 48",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  // `sub` é claim reservado e deve ser string; demais campos vão como custom.
  return new SignJWT({
    tipo: payload.tipo,
    nome: payload.nome,
    email: payload.email,
    ...(payload.membroId != null ? { membroId: payload.membroId } : {}),
    ...(payload.papel ? { papel: payload.papel } : {}),
    ...(payload.membroNome ? { membroNome: payload.membroNome } : {}),
    ...(payload.financeiro ? { financeiro: true } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.sub !== "undefined" &&
      (payload.tipo === "TRABALHADOR" || payload.tipo === "EMPRESA")
    ) {
      return {
        sub: Number(payload.sub),
        tipo: payload.tipo as TipoConta,
        nome: String(payload.nome ?? ""),
        email: String(payload.email ?? ""),
        ...(typeof payload.membroId === "number" ? { membroId: payload.membroId } : {}),
        ...(ehPapel(payload.papel) ? { papel: payload.papel } : {}),
        ...(payload.membroNome ? { membroNome: String(payload.membroNome) } : {}),
    ...(payload.financeiro === true ? { financeiro: true } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
