import { describe, it, expect } from "vitest";
import {
  STATUS_ABERTOS,
  TIPOS_SOLICITACAO,
  definicaoTipo,
  ehStatusTerminal,
  ehTipoSolicitacao,
  estadoDoEvento,
  estadoPresenca,
  mensagemTransicaoInvalida,
  minutosEmTurno,
  motivoCanalIndisponivel,
  ordenarFila,
  transicaoValida,
  transicoesPermitidas,
} from "@/lib/domain/comunicacao";

/**
 * Comunicação do evento. Dois pontos sensíveis: a janela em que o canal existe
 * (depende de fuso) e as transições de status (evita histórico incoerente).
 */

describe("tipos de solicitação", () => {
  it("cobre os seis pedidos da especificação", () => {
    expect(TIPOS_SOLICITACAO.map((t) => t.id)).toEqual([
      "INTERVALO",
      "DESCANSO",
      "PROBLEMA",
      "AJUDA",
      "SUBSTITUICAO",
      "FALAR_COORDENACAO",
    ]);
  });

  it("marca como urgentes os que interrompem o trabalho", () => {
    expect(definicaoTipo("PROBLEMA").urgente).toBe(true);
    expect(definicaoTipo("AJUDA").urgente).toBe(true);
    expect(definicaoTipo("SUBSTITUICAO").urgente).toBe(true);
    expect(definicaoTipo("INTERVALO").urgente).toBe(false);
  });

  it("valida o tipo vindo do formulário", () => {
    expect(ehTipoSolicitacao("AJUDA")).toBe(true);
    expect(ehTipoSolicitacao("CAFEZINHO")).toBe(false);
    expect(ehTipoSolicitacao(null)).toBe(false);
  });
});

describe("estadoDoEvento", () => {
  // 15/08/2026, 20h em Brasília = 23h UTC.
  const duranteODia = new Date("2026-08-15T20:00:00.000Z");

  it("evento de hoje está em andamento", () => {
    expect(estadoDoEvento("2026-08-15", "PUBLICADO", duranteODia)).toBe("EM_ANDAMENTO");
  });

  it("evento futuro e passado não estão em andamento", () => {
    expect(estadoDoEvento("2026-08-20", "PUBLICADO", duranteODia)).toBe("FUTURO");
    expect(estadoDoEvento("2026-08-10", "PUBLICADO", duranteODia)).toBe("ENCERRADO");
  });

  it("finalizado ou cancelado está encerrado, mesmo sendo hoje", () => {
    expect(estadoDoEvento("2026-08-15", "FINALIZADO", duranteODia)).toBe("ENCERRADO");
    expect(estadoDoEvento("2026-08-15", "CANCELADO", duranteODia)).toBe("ENCERRADO");
  });

  it("madrugada em UTC ainda é o dia anterior em Brasília", () => {
    // 16/08 00:30 UTC = 15/08 21:30 em Brasília: o evento do dia 15 segue em andamento.
    const madrugadaUtc = new Date("2026-08-16T00:30:00.000Z");
    expect(estadoDoEvento("2026-08-15", "PUBLICADO", madrugadaUtc)).toBe("EM_ANDAMENTO");
    expect(estadoDoEvento("2026-08-16", "PUBLICADO", madrugadaUtc)).toBe("FUTURO");
  });

  it("explica por que o canal está fechado", () => {
    expect(motivoCanalIndisponivel("EM_ANDAMENTO")).toBeNull();
    expect(motivoCanalIndisponivel("FUTURO")).toMatch(/abre no dia do evento/);
    expect(motivoCanalIndisponivel("ENCERRADO")).toMatch(/histórico/);
  });
});

describe("transições de status", () => {
  it("de Em análise dá para aprovar, recusar ou pedir para aguardar", () => {
    expect(transicoesPermitidas("EM_ANALISE")).toEqual(["APROVADA", "RECUSADA", "AGUARDANDO"]);
  });

  it("de Aguardando dá para aprovar, recusar ou finalizar", () => {
    expect(transicoesPermitidas("AGUARDANDO")).toEqual(["APROVADA", "RECUSADA", "FINALIZADA"]);
  });

  it("aprovada só finaliza; recusada e finalizada são terminais", () => {
    expect(transicoesPermitidas("APROVADA")).toEqual(["FINALIZADA"]);
    expect(ehStatusTerminal("RECUSADA")).toBe(true);
    expect(ehStatusTerminal("FINALIZADA")).toBe(true);
    expect(ehStatusTerminal("EM_ANALISE")).toBe(false);
  });

  it("recusa transição inválida com mensagem útil", () => {
    expect(transicaoValida("EM_ANALISE", "APROVADA")).toBe(true);
    expect(transicaoValida("FINALIZADA", "APROVADA")).toBe(false);
    expect(mensagemTransicaoInvalida("FINALIZADA", "APROVADA")).toMatch(/não muda mais/);
    expect(mensagemTransicaoInvalida("APROVADA", "RECUSADA")).toMatch(/Possíveis agora: Finalizada/);
  });
});

describe("ordenarFila", () => {
  const s = (tipo: Parameters<typeof definicaoTipo>[0], status: Parameters<typeof ehStatusTerminal>[0], min: number) => ({
    tipo,
    status,
    createdAt: new Date(`2026-08-15T18:${String(min).padStart(2, "0")}:00.000Z`),
    id: `${tipo}-${status}-${min}`,
  });

  it("abertas antes de resolvidas, urgentes na frente, mais antigas primeiro", () => {
    const fila = ordenarFila([
      s("INTERVALO", "EM_ANALISE", 30),
      s("AJUDA", "EM_ANALISE", 40),
      s("PROBLEMA", "FINALIZADA", 10),
      s("SUBSTITUICAO", "AGUARDANDO", 20),
      s("INTERVALO", "APROVADA", 5),
    ]);
    expect(fila.map((f) => f.id)).toEqual([
      "SUBSTITUICAO-AGUARDANDO-20", // aberta + urgente + mais antiga
      "AJUDA-EM_ANALISE-40", // aberta + urgente
      "INTERVALO-EM_ANALISE-30", // aberta, não urgente
      "PROBLEMA-FINALIZADA-10", // resolvida + urgente
      "INTERVALO-APROVADA-5", // resolvida, não urgente
    ]);
  });

  it("status abertos são os que esperam ação", () => {
    expect(STATUS_ABERTOS).toEqual(["EM_ANALISE", "AGUARDANDO"]);
  });
});

describe("presença (check-in/check-out)", () => {
  const entrada = new Date("2026-08-15T19:00:00.000Z");
  const saida = new Date("2026-08-16T02:30:00.000Z");

  it("classifica o estado do turno", () => {
    expect(estadoPresenca(null, null)).toBe("AGUARDANDO_CHECKIN");
    expect(estadoPresenca(entrada, null)).toBe("EM_TURNO");
    expect(estadoPresenca(entrada, saida)).toBe("TURNO_ENCERRADO");
  });

  it("calcula minutos em turno (encerrado e em andamento)", () => {
    expect(minutosEmTurno(entrada, saida)).toBe(450); // 7h30
    expect(minutosEmTurno(entrada, null, new Date("2026-08-15T21:00:00.000Z"))).toBe(120);
    expect(minutosEmTurno(null, null)).toBeNull();
  });
});
