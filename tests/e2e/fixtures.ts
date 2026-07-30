import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Fixtures e utilitários para os testes E2E.
 *
 * Filosofia de isolamento: cada teste cria seus próprios dados com
 * identificadores únicos (CPF/CNPJ válidos gerados, e-mails com sufixo único).
 * Assim os testes não dependem do seed nem interferem entre si — podem rodar
 * em paralelo e repetidamente sem "sujar" uns aos outros.
 */

export const SENHA = "Senha@123";
const SENHA_HASH = bcrypt.hashSync(SENHA, 10);

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://escala:escala@localhost:5432/escala?schema=public";

export const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// ----------------------------------------------------------------------------
// Geradores de documentos válidos (dígitos verificadores corretos)
// ----------------------------------------------------------------------------

let contador = 0;
/** Sufixo único e estável dentro da execução. */
export function uid(): string {
  contador += 1;
  return `${Date.now().toString(36)}${contador.toString(36)}`;
}

function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export function gerarCpf(): string {
  const base = randomDigits(9);
  const calc = (b: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < b.length; i++) soma += Number(b[i]) * (pesoInicial - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(base, 10);
  const d2 = calc(base + d1, 11);
  return `${base}${d1}${d2}`;
}

export function gerarCnpj(): string {
  const base = randomDigits(8) + "0001";
  const calc = (b: string) => {
    const pesos = b.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < b.length; i++) soma += Number(b[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(base);
  const d2 = calc(base + d1);
  return `${base}${d1}${d2}`;
}

// ----------------------------------------------------------------------------
// Factories (escrita direta no banco para "arrange" rápido e determinístico)
// ----------------------------------------------------------------------------

export type PapelFix = "PROPRIETARIO" | "ADMIN" | "COORDENADOR" | "VISUALIZADOR";
export type PlanoFix = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface EmpresaFix {
  id: number;
  nome: string;
  email: string;
  cnpj: string;
  senha: string;
  /** Id do membro PROPRIETARIO criado junto com a empresa (v3 SaaS). */
  membroId: number;
}
export interface MembroFix { id: number; nome: string; email: string; papel: PapelFix; senha: string }
export interface TrabalhadorFix { id: number; nome: string; email: string; cpf: string; senha: string }

/**
 * Empresa completa no formato v3 (SaaS): a conta nasce com um membro
 * PROPRIETARIO (o login de empresa resolve por `membros`) e uma assinatura.
 * `plano` permite testar o gating (default STARTER, igual ao cadastro real).
 */
export async function novaEmpresa(
  over: Partial<{ nome: string; plano: PlanoFix }> = {},
): Promise<EmpresaFix> {
  const u = uid();
  const email = `emp_${u}@e2e.test`;
  const empresa = await prisma.empresa.create({
    data: {
      nome: over.nome ?? `Empresa E2E ${u}`,
      cnpj: gerarCnpj(),
      email,
      telefone: "61999990000",
      senhaHash: SENHA_HASH,
      membros: {
        create: { nome: over.nome ?? `Empresa E2E ${u}`, email, senhaHash: SENHA_HASH, papel: "PROPRIETARIO" },
      },
      assinatura: { create: { plano: over.plano ?? "STARTER", status: "ATIVA" } },
    },
    include: { membros: true },
  });
  return {
    id: empresa.id,
    nome: empresa.nome,
    email,
    cnpj: empresa.cnpj,
    senha: SENHA,
    membroId: empresa.membros[0].id,
  };
}

/** Membro adicional da empresa, para testar RBAC por papel. */
export async function novoMembro(empresaId: number, papel: PapelFix): Promise<MembroFix> {
  const u = uid();
  const email = `membro_${u}@e2e.test`;
  const membro = await prisma.membro.create({
    data: { empresaId, nome: `Membro ${papel} ${u}`, email, senhaHash: SENHA_HASH, papel },
  });
  return { id: membro.id, nome: membro.nome, email, papel, senha: SENHA };
}

/** Troca o plano da empresa (gating de limites/recursos). */
export async function definirPlano(empresaId: number, plano: PlanoFix) {
  return prisma.assinatura.upsert({
    where: { empresaId },
    create: { empresaId, plano, status: "ATIVA" },
    update: { plano, status: "ATIVA" },
  });
}

export async function novoTrabalhador(over: Partial<{ nome: string }> = {}): Promise<TrabalhadorFix> {
  const u = uid();
  const email = `trab_${u}@e2e.test`;
  const user = await prisma.user.create({
    data: {
      nome: over.nome ?? `Trab E2E ${u}`,
      cpf: gerarCpf(),
      email,
      dataNascimento: new Date("1995-01-01"),
      telefone: "61988880000",
      senhaHash: SENHA_HASH,
    },
  });
  return { id: user.id, nome: user.nome, email, cpf: user.cpf, senha: SENHA };
}

export async function vincular(
  userId: number,
  empresaId: number,
  status: "ATIVO" | "PENDENTE" = "ATIVO",
  solicitadoPor: "EMPRESA" | "TRABALHADOR" = "EMPRESA",
) {
  return prisma.vinculo.create({ data: { userId, empresaId, status, solicitadoPor } });
}

export async function novoEvento(
  empresaId: number,
  over: Partial<{ nome: string; vagas: number; valorCache: number; funcoes: string; status: "PUBLICADO" | "FINALIZADO" }> = {},
) {
  return prisma.evento.create({
    data: {
      empresaId,
      nome: over.nome ?? `Evento E2E ${uid()}`,
      dataEvento: new Date("2026-12-20"),
      local: "Local E2E",
      vagas: over.vagas ?? 5,
      funcoes: over.funcoes ?? "Apoio",
      valorCache: over.valorCache ?? 150,
      status: over.status ?? "PUBLICADO",
    },
  });
}

export async function inscrever(
  eventoId: number,
  userId: number,
  status: "INSCRITO" | "ESCALADO" = "INSCRITO",
) {
  return prisma.inscricao.create({ data: { eventoId, userId, status } });
}

// ----------------------------------------------------------------------------
// Helpers de UI
// ----------------------------------------------------------------------------

export async function loginUI(
  page: Page,
  tipo: "TRABALHADOR" | "EMPRESA",
  email: string,
  senha = SENHA,
  opts: { esperarEntrar?: boolean } = {},
) {
  const { esperarEntrar = true } = opts;
  await page.goto(`/login?tipo=${tipo}`);
  if (tipo === "EMPRESA") await page.getByRole("button", { name: "Empresa" }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Garante que a sessão foi estabelecida antes de qualquer navegação seguinte
  // (evita corrida em que o cookie ainda não foi setado).
  if (esperarEntrar) {
    await page.waitForURL(/\/(empresa|trabalhador)\//, { timeout: 15000 });
  }
}

export const test = base;
export { expect };
