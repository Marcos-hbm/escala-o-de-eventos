import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cifrar } from "@/lib/cripto";
import { chavePixMascarada, lerChavePixParaEmpresa } from "@/lib/pix-leitura";

/**
 * Integração — leitura da chave PIX pela empresa.
 *
 * É o ponto mais sensível do sistema: dado pessoal cifrado, com autorização por
 * relacionamento e auditoria obrigatória (item 13 da especificação). Os três
 * comportamentos verificados aqui não podem ser garantidos em teste unitário
 * porque dependem de vínculo real no banco e do registro em `audit_logs`.
 */

const prisma = new PrismaClient();
const HASH = bcrypt.hashSync("Senha@123", 10);
const marca = `pix${Date.now().toString(36)}${process.pid.toString(36)}`;

let empresaComEscala: number;
let empresaSemEscala: number;
let membroId: number;
let trabalhadorComPix: number;
let trabalhadorSemPix: number;
let eventoId: number;

const CHAVE = "ana.pix@exemplo.com";

function doc(n: number, tam = 14) {
  return String(n).padStart(tam, "8").slice(-tam);
}

beforeAll(async () => {
  const e1 = await prisma.empresa.create({
    data: {
      nome: `PIX empresa ${marca}`,
      cnpj: doc(Date.now()),
      email: `pixemp_${marca}@integr.test`,
      telefone: "61999990000",
      senhaHash: HASH,
      membros: {
        create: {
          nome: "Financeiro",
          email: `pixmembro_${marca}@integr.test`,
          senhaHash: HASH,
          papel: "COORDENADOR",
          autorizadoFinanceiro: true,
        },
      },
    },
    include: { membros: true },
  });
  empresaComEscala = e1.id;
  membroId = e1.membros[0].id;

  const e2 = await prisma.empresa.create({
    data: {
      nome: `PIX outra ${marca}`,
      cnpj: doc(Date.now() + 3),
      email: `pixemp2_${marca}@integr.test`,
      telefone: "61999990002",
      senhaHash: HASH,
    },
  });
  empresaSemEscala = e2.id;

  const comPix = await prisma.user.create({
    data: {
      nome: `Com PIX ${marca}`,
      email: `compix_${marca}@integr.test`,
      cpf: doc(Date.now() + 4, 11),
      dataNascimento: new Date("1995-01-01"),
      telefone: "61988880000",
      senhaHash: HASH,
      pixTipo: "EMAIL",
      pixChaveCifrada: cifrar(CHAVE),
      pixAtualizadoEm: new Date(),
    },
  });
  trabalhadorComPix = comPix.id;

  const semPix = await prisma.user.create({
    data: {
      nome: `Sem PIX ${marca}`,
      email: `sempix_${marca}@integr.test`,
      cpf: doc(Date.now() + 5, 11),
      dataNascimento: new Date("1995-01-01"),
      telefone: "61988880001",
      senhaHash: HASH,
    },
  });
  trabalhadorSemPix = semPix.id;

  const evento = await prisma.evento.create({
    data: {
      empresaId: empresaComEscala,
      nome: `PIX evento ${marca}`,
      dataEvento: new Date("2026-12-20"),
      vagas: 2,
      valorCache: 150,
      status: "FINALIZADO",
    },
  });
  eventoId = evento.id;
  await prisma.inscricao.create({ data: { eventoId, userId: trabalhadorComPix, status: "ESCALADO" } });
  await prisma.inscricao.create({ data: { eventoId, userId: trabalhadorSemPix, status: "ESCALADO" } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { atorId: { in: [empresaComEscala, empresaSemEscala] } } });
  await prisma.evento.deleteMany({ where: { empresaId: empresaComEscala } });
  await prisma.empresa.deleteMany({ where: { id: { in: [empresaComEscala, empresaSemEscala] } } });
  await prisma.user.deleteMany({ where: { id: { in: [trabalhadorComPix, trabalhadorSemPix] } } });
  await prisma.$disconnect();
});

describe("empresa que escalou o trabalhador", () => {
  it("lê a chave decifrada e registra a leitura em auditoria", async () => {
    const antes = await prisma.auditLog.count({ where: { acao: "PIX_VISUALIZADO", entidadeId: trabalhadorComPix } });

    const r = await lerChavePixParaEmpresa({
      empresaId: empresaComEscala,
      userId: trabalhadorComPix,
      membroId,
      membroNome: "Financeiro",
      eventoId,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chave.valor).toBe(CHAVE);
    expect(r.chave.tipo).toBe("EMAIL");

    const depois = await prisma.auditLog.findMany({
      where: { acao: "PIX_VISUALIZADO", entidadeId: trabalhadorComPix },
      orderBy: { id: "desc" },
      take: 1,
    });
    expect(depois).toHaveLength(1);
    expect(depois[0].detalhe).toContain("Financeiro");
    expect(depois[0].detalhe).toContain("EMAIL");
    expect(
      await prisma.auditLog.count({ where: { acao: "PIX_VISUALIZADO", entidadeId: trabalhadorComPix } }),
    ).toBe(antes + 1);
  });

  it("informa quando o trabalhador não cadastrou chave", async () => {
    const r = await lerChavePixParaEmpresa({ empresaId: empresaComEscala, userId: trabalhadorSemPix, membroId });
    expect(r).toMatchObject({ ok: false, motivo: "sem_chave" });
    if (!r.ok) expect(r.mensagem).toMatch(/outra forma de pagamento/i);
  });
});

describe("empresa sem escalação do trabalhador", () => {
  it("não lê a chave e não gera registro de auditoria", async () => {
    const antes = await prisma.auditLog.count({ where: { acao: "PIX_VISUALIZADO", atorId: empresaSemEscala } });

    const r = await lerChavePixParaEmpresa({ empresaId: empresaSemEscala, userId: trabalhadorComPix, membroId });
    expect(r).toMatchObject({ ok: false, motivo: "sem_vinculo" });

    expect(await prisma.auditLog.count({ where: { acao: "PIX_VISUALIZADO", atorId: empresaSemEscala } })).toBe(antes);
  });
});

describe("visão do próprio trabalhador", () => {
  it("recebe a chave mascarada, sem auditoria", async () => {
    const antes = await prisma.auditLog.count({ where: { acao: "PIX_VISUALIZADO" } });

    const mascarada = await chavePixMascarada(trabalhadorComPix);
    // "ana.pix" tem 7 caracteres: 2 visíveis + 5 asteriscos.
    expect(mascarada).toEqual({ tipo: "EMAIL", mascara: "an*****@exemplo.com" });
    expect(mascarada?.mascara).not.toContain(CHAVE);

    expect(await prisma.auditLog.count({ where: { acao: "PIX_VISUALIZADO" } })).toBe(antes);
  });

  it("devolve null quando não há chave cadastrada", async () => {
    expect(await chavePixMascarada(trabalhadorSemPix)).toBeNull();
  });
});

describe("o que fica gravado na coluna", () => {
  it("é texto cifrado versionado, não a chave em claro", async () => {
    const linha = await prisma.user.findUniqueOrThrow({
      where: { id: trabalhadorComPix },
      select: { pixChaveCifrada: true },
    });
    expect(linha.pixChaveCifrada).not.toContain(CHAVE);
    expect(linha.pixChaveCifrada?.startsWith("v1.")).toBe(true);
  });
});
