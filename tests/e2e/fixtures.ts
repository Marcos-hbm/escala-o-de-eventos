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
/**
 * Sufixo único. Inclui o PID porque o Playwright roda vários workers em processos
 * separados: só `Date.now()` + contador colidia quando dois workers começavam no
 * mesmo milissegundo, gerando e-mail duplicado (membros.email é único) e falha
 * intermitente que parecia bug de produto.
 */
export function uid(): string {
  contador += 1;
  return `${Date.now().toString(36)}${process.pid.toString(36)}${contador.toString(36)}`;
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
export type FormaPagamentoFix = "PIX" | "DINHEIRO" | "CARTAO_CREDITO";
export type TipoChavePixFix = "CPF" | "CNPJ" | "EMAIL" | "TELEFONE" | "ALEATORIA";
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

/**
 * Membro adicional da empresa, para testar RBAC por papel.
 * `autorizadoFinanceiro` cobre o "coordenador autorizado" da v4.
 */
export async function novoMembro(
  empresaId: number,
  papel: PapelFix,
  opts: { autorizadoFinanceiro?: boolean } = {},
): Promise<MembroFix> {
  const u = uid();
  const email = `membro_${u}@e2e.test`;
  const membro = await prisma.membro.create({
    data: {
      empresaId,
      nome: `Membro ${papel} ${u}`,
      email,
      senhaHash: SENHA_HASH,
      papel,
      autorizadoFinanceiro: opts.autorizadoFinanceiro ?? false,
    },
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

/**
 * Espera a app ficar interativa (React hidratado). Clicar antes disso é uma
 * corrida: o evento pode não ser tratado nem pelo submit nativo nem pelo React,
 * a server action roda mas a tela não reflete — falha intermitente que parece bug
 * de produto e não é.
 */
export async function aguardarHidratacao(page: Page) {
  await page.locator('[data-hidratado="true"]').first().waitFor({ state: "attached", timeout: 15000 });
}

/** `goto` + espera de interatividade. Use sempre que a próxima ação for um clique. */
export async function irPara(page: Page, url: string) {
  await page.goto(url);
  await aguardarHidratacao(page);
}

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
    await aguardarHidratacao(page);
  }
}

export const test = base;
export { expect };

// ----------------------------------------------------------------------------
// v4 — financeiro, relacionamento e comunicação
// ----------------------------------------------------------------------------

/**
 * Cadastra chave PIX cifrada no trabalhador.
 *
 * Usa o mesmo módulo da aplicação (`lib/cripto`) de propósito: se a cifragem
 * mudar de formato, o teste falha junto — fixture que grava por conta própria
 * esconderia a quebra.
 */
export async function definirChavePix(userId: number, tipo: TipoChavePixFix, valor: string) {
  const { cifrar } = await import("../../src/lib/cripto");
  return prisma.user.update({
    where: { id: userId },
    data: { pixTipo: tipo, pixChaveCifrada: cifrar(valor), pixAtualizadoEm: new Date() },
  });
}

/** Pagamento (saldo devido) de um trabalhador em um evento. */
export async function novoPagamento(
  eventoId: number,
  userId: number,
  empresaId: number,
  over: Partial<{ valorDevido: number; valorPago: number; forma: FormaPagamentoFix; funcao: string }> = {},
) {
  const valorDevido = over.valorDevido ?? 150;
  const valorPago = over.valorPago ?? 0;
  return prisma.pagamento.create({
    data: {
      eventoId,
      userId,
      empresaId,
      valorDevido,
      valorPago,
      status: valorPago <= 0 ? "PENDENTE" : valorPago >= valorDevido ? "PAGO" : "PARCIAL",
      forma: over.forma,
      funcao: over.funcao ?? "Apoio",
    },
  });
}

/** Marca um trabalhador como favorito da empresa. */
export async function favoritar(empresaId: number, userId: number) {
  return prisma.trabalhadorFavorito.create({ data: { empresaId, userId } });
}

/** Bloqueia um trabalhador na empresa (bloqueio vigente). */
export async function bloquear(empresaId: number, userId: number, motivo = "Motivo de teste E2E") {
  return prisma.trabalhadorBloqueio.create({ data: { empresaId, userId, motivo } });
}

/**
 * Evento acontecendo **hoje** — é a janela em que a comunicação do evento existe
 * (`estadoDoEvento`). A data é calculada no fuso de Brasília, igual à regra do
 * domínio, senão o teste quebraria de madrugada.
 */
export async function novoEventoHoje(
  empresaId: number,
  over: Partial<{ nome: string; vagas: number; valorCache: number; horaInicio: string }> = {},
) {
  const { diaCivilBR } = await import("../../src/lib/datetime");
  return prisma.evento.create({
    data: {
      empresaId,
      nome: over.nome ?? `Evento hoje ${uid()}`,
      dataEvento: new Date(`${diaCivilBR()}T00:00:00.000Z`),
      local: "Local E2E",
      horaInicio: over.horaInicio ?? "08:00",
      vagas: over.vagas ?? 5,
      funcoes: "Apoio",
      valorCache: over.valorCache ?? 150,
      status: "PUBLICADO",
    },
  });
}

/** Mensagem da coordenação (equipe inteira quando `userId` é omitido). */
export async function novaMensagemCoordenacao(eventoId: number, membroId: number, texto: string, userId?: number) {
  return prisma.mensagemCoordenador.create({ data: { eventoId, membroId, texto, userId: userId ?? null } });
}

/** Registro de presença (check-in/check-out) de uma escalação. */
export async function registrarPresenca(inscricaoId: number, checkInEm?: Date, checkOutEm?: Date) {
  return prisma.registroPresenca.upsert({
    where: { inscricaoId },
    create: { inscricaoId, checkInEm: checkInEm ?? null, checkOutEm: checkOutEm ?? null },
    update: { checkInEm: checkInEm ?? null, checkOutEm: checkOutEm ?? null },
  });
}

/** Solicitação do trabalhador durante o evento. */
export async function novaSolicitacao(
  eventoId: number,
  userId: number,
  tipo: "INTERVALO" | "DESCANSO" | "PROBLEMA" | "AJUDA" | "SUBSTITUICAO" | "FALAR_COORDENACAO" = "INTERVALO",
  mensagem = "Solicitação de teste E2E",
) {
  return prisma.solicitacaoEvento.create({ data: { eventoId, userId, tipo, mensagem } });
}
