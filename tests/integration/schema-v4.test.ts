import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Integração — invariantes da v4 no PostgreSQL real.
 *
 * O que este arquivo cobre não pode ser testado em unidade: CHECK constraints e
 * índices parciais só existem no banco. São as regras que precisam valer mesmo se
 * um dia alguém escrever direto no banco ou uma action esquecer a validação.
 */

const prisma = new PrismaClient();
const HASH = bcrypt.hashSync("Senha@123", 10);
const marca = `it${Date.now().toString(36)}${process.pid.toString(36)}`;

let empresaId: number;
let outraEmpresaId: number;
let userId: number;
let membroId: number;
let eventoId: number;
let inscricaoId: number;

function docs(n: number) {
  return String(n).padStart(14, "9").slice(-14);
}

beforeAll(async () => {
  const empresa = await prisma.empresa.create({
    data: {
      nome: `Integração ${marca}`,
      cnpj: docs(Date.now()),
      email: `emp_${marca}@integr.test`,
      telefone: "61999990000",
      senhaHash: HASH,
      membros: { create: { nome: "Dono", email: `dono_${marca}@integr.test`, senhaHash: HASH, papel: "PROPRIETARIO" } },
      assinatura: { create: { plano: "PROFESSIONAL", status: "ATIVA" } },
    },
    include: { membros: true },
  });
  empresaId = empresa.id;
  membroId = empresa.membros[0].id;

  const outra = await prisma.empresa.create({
    data: {
      nome: `Integração outra ${marca}`,
      cnpj: docs(Date.now() + 1),
      email: `emp2_${marca}@integr.test`,
      telefone: "61999990001",
      senhaHash: HASH,
    },
  });
  outraEmpresaId = outra.id;

  const user = await prisma.user.create({
    data: {
      nome: `Trab ${marca}`,
      email: `trab_${marca}@integr.test`,
      cpf: docs(Date.now() + 2).slice(0, 11),
      dataNascimento: new Date("1995-01-01"),
      telefone: "61988880000",
      senhaHash: HASH,
    },
  });
  userId = user.id;

  const evento = await prisma.evento.create({
    data: {
      empresaId,
      nome: `Evento ${marca}`,
      dataEvento: new Date("2026-12-20"),
      vagas: 3,
      valorCache: 150,
      status: "FINALIZADO",
    },
  });
  eventoId = evento.id;

  const insc = await prisma.inscricao.create({ data: { eventoId, userId, status: "ESCALADO" } });
  inscricaoId = insc.id;
});

afterAll(async () => {
  // Limpa o que este arquivo criou (cascade cobre filhos).
  await prisma.evento.deleteMany({ where: { empresaId } });
  await prisma.empresa.deleteMany({ where: { id: { in: [empresaId, outraEmpresaId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("notificações: destinatário exclusivo", () => {
  it("aceita notificação para trabalhador", async () => {
    const n = await prisma.notificacao.create({
      data: { userId, tipo: "NOVO_EVENTO", titulo: "Para o trabalhador", mensagem: "ok" },
    });
    expect(n.membroId).toBeNull();
  });

  it("aceita notificação para membro da empresa (novidade da v4)", async () => {
    const n = await prisma.notificacao.create({
      data: { membroId, tipo: "SOLICITACAO_RECEBIDA", titulo: "Para o coordenador", mensagem: "ok" },
    });
    expect(n.userId).toBeNull();
  });

  it("recusa notificação sem destinatário", async () => {
    await expect(
      prisma.notificacao.create({ data: { tipo: "NOVO_EVENTO", titulo: "Órfã", mensagem: "x" } }),
    ).rejects.toThrow(/destinatario_exclusivo/);
  });

  it("recusa notificação com os dois destinatários", async () => {
    await expect(
      prisma.notificacao.create({
        data: { userId, membroId, tipo: "NOVO_EVENTO", titulo: "Ambígua", mensagem: "x" },
      }),
    ).rejects.toThrow(/destinatario_exclusivo/);
  });
});

describe("pagamentos: invariantes de dinheiro", () => {
  it("recusa valor pago acima do devido", async () => {
    await expect(
      prisma.pagamento.create({
        data: { eventoId, userId, empresaId, valorDevido: 100, valorPago: 150 },
      }),
    ).rejects.toThrow(/pago_nao_excede_devido/);
  });

  it("recusa valores negativos", async () => {
    // Valor PAGO negativo isola a constraint de não negatividade; com `valorDevido`
    // negativo, quem dispara primeiro é `pago_nao_excede_devido` (0 > -10).
    await expect(
      prisma.pagamento.create({ data: { eventoId, userId, empresaId, valorDevido: 100, valorPago: -5 } }),
    ).rejects.toThrow(/valores_nao_negativos/);

    await expect(
      prisma.pagamento.create({ data: { eventoId, userId, empresaId, valorDevido: -10 } }),
    ).rejects.toThrow(/pago_nao_excede_devido|valores_nao_negativos/);
  });

  it("um pagamento por trabalhador por evento", async () => {
    const p = await prisma.pagamento.create({
      data: { eventoId, userId, empresaId, valorDevido: 150, valorPago: 50, status: "PARCIAL", forma: "PIX" },
    });
    await expect(
      prisma.pagamento.create({ data: { eventoId, userId, empresaId, valorDevido: 150 } }),
    ).rejects.toThrow();
    // lançamento com valor zero é recusado
    await expect(
      prisma.pagamentoLancamento.create({ data: { pagamentoId: p.id, valor: 0, forma: "PIX" } }),
    ).rejects.toThrow(/valor_positivo/);
  });
});

describe("avaliação por critérios", () => {
  it("aceita notas 1..5 nos cinco critérios", async () => {
    const a = await prisma.avaliacao.create({
      data: {
        eventoId,
        empresaId,
        userId,
        autor: "EMPRESA",
        nota: 5,
        notaPontualidade: 5,
        notaComunicacao: 4,
        notaTrabalhoEquipe: 5,
        notaQualidade: 5,
        notaComprometimento: 4,
      },
    });
    expect(a.notaComunicacao).toBe(4);
  });

  it("recusa nota fora da faixa", async () => {
    await expect(
      prisma.avaliacao.create({
        data: { eventoId, empresaId, userId, autor: "TRABALHADOR", nota: 5, notaQualidade: 9 },
      }),
    ).rejects.toThrow(/notas_1_a_5/);
  });
});

describe("bloqueio: um vigente por par empresa×trabalhador", () => {
  it("recusa segundo bloqueio vigente e permite novo depois da remoção", async () => {
    const primeiro = await prisma.trabalhadorBloqueio.create({
      data: { empresaId, userId, motivo: "Faltou sem avisar" },
    });

    await expect(
      prisma.trabalhadorBloqueio.create({ data: { empresaId, userId, motivo: "Outro motivo" } }),
    ).rejects.toThrow();

    // Removido o bloqueio, a linha histórica permanece e um novo pode existir.
    await prisma.trabalhadorBloqueio.update({
      where: { id: primeiro.id },
      data: { removidoEm: new Date(), motivoRemocao: "Conversado" },
    });
    const segundo = await prisma.trabalhadorBloqueio.create({
      data: { empresaId, userId, motivo: "Reincidência" },
    });
    expect(segundo.id).not.toBe(primeiro.id);

    const historico = await prisma.trabalhadorBloqueio.count({ where: { empresaId, userId } });
    expect(historico).toBe(2);
    const vigentes = await prisma.trabalhadorBloqueio.count({ where: { empresaId, userId, removidoEm: null } });
    expect(vigentes).toBe(1);
  });
});

describe("contestação: uma em aberto por pagamento", () => {
  it("recusa duplicada em aberto e libera depois de resolver", async () => {
    // Evento próprio: `pagamentos` tem unique (evento, trabalhador), e o evento
    // principal já foi usado no bloco anterior.
    const eventoContestacao = await prisma.evento.create({
      data: {
        empresaId,
        nome: `Evento contestação ${marca}`,
        dataEvento: new Date("2026-11-15"),
        vagas: 2,
        valorCache: 150,
        status: "FINALIZADO",
      },
    });
    const pagamento = await prisma.pagamento.create({
      data: {
        eventoId: eventoContestacao.id,
        userId,
        empresaId,
        valorDevido: 150,
        valorPago: 150,
        status: "PAGO",
        forma: "PIX",
      },
    });
    const primeira = await prisma.contestacaoPagamento.create({
      data: { pagamentoId: pagamento.id, userId, motivo: "Valor menor", descricao: "Recebi menos que o combinado." },
    });
    await expect(
      prisma.contestacaoPagamento.create({
        data: { pagamentoId: pagamento.id, userId, motivo: "Duplicada", descricao: "x" },
      }),
    ).rejects.toThrow();

    await prisma.contestacaoPagamento.update({
      where: { id: primeira.id },
      data: { status: "RESOLVIDA", resposta: "Ajustado", respondidoEm: new Date() },
    });
    const nova = await prisma.contestacaoPagamento.create({
      data: { pagamentoId: pagamento.id, userId, motivo: "Outro problema", descricao: "y" },
    });
    expect(nova.status).toBe("ABERTA");
  });
});

describe("presença detalhada e fechamento de caixa", () => {
  it("registra check-in/check-out e um fechamento por evento", async () => {
    const presenca = await prisma.registroPresenca.create({
      data: {
        inscricaoId,
        checkInEm: new Date("2026-12-20T19:00:00.000Z"),
        checkOutEm: new Date("2026-12-21T02:00:00.000Z"),
        registradoPorMembroId: membroId,
      },
    });
    expect(presenca.checkOutEm).not.toBeNull();

    await prisma.fechamentoCaixa.create({
      data: { eventoId, empresaId, iniciadoPorMembroId: membroId },
    });
    await expect(prisma.fechamentoCaixa.create({ data: { eventoId, empresaId } })).rejects.toThrow();
  });
});
