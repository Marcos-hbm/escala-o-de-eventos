import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  diaCivilBR,
  formatarData,
  formatarDataCivil,
  formatarDataCivilExtensa,
  formatarDataHora,
  formatarDiaSemanaCurto,
  formatarDuracao,
  formatarHora,
  formatarPeriodo,
  formatarRelativo,
  duracaoEmMinutos,
  horaEmMinutos,
  horaValida,
  instanteDeDataHoraBR,
  minutosEmHora,
  normalizarHora,
  paraInputDate,
} from "@/lib/datetime";

/**
 * Padrão brasileiro de data/hora. O caso que mais importa aqui é a distinção
 * entre data civil (@db.Date) e instante (timestamp): formatar os dois do mesmo
 * jeito produz dia errado em uma das duas situações.
 */

describe("data civil (colunas @db.Date)", () => {
  it("não desloca o dia (meia-noite UTC não vira o dia anterior em Brasília)", () => {
    // Prisma devolve `dataEvento` de 15/08/2026 como 2026-08-15T00:00:00.000Z
    const dataEvento = new Date("2026-08-15T00:00:00.000Z");
    expect(formatarDataCivil(dataEvento)).toBe("15/08/2026");
  });

  it("formata por extenso e dia da semana", () => {
    const d = new Date("2026-08-15T00:00:00.000Z"); // sábado
    expect(formatarDataCivilExtensa(d)).toBe("15 de agosto de 2026");
    expect(formatarDiaSemanaCurto(d)).toBe("sáb");
  });

  it("gera valor para <input type=date>", () => {
    expect(paraInputDate(new Date("2026-12-01T00:00:00.000Z"))).toBe("2026-12-01");
  });

  it("entrada inválida não vira 'Invalid Date' na tela", () => {
    expect(formatarDataCivil("não é data")).toBe("—");
    expect(formatarDataCivil(null as unknown as string, "sem data")).toBe("sem data");
  });
});

describe("instante (timestamps) no fuso de Brasília", () => {
  it("22:30Z do dia 30 é 19:30 do dia 30 em Brasília", () => {
    const t = new Date("2026-07-30T22:30:00.000Z");
    expect(formatarData(t)).toBe("30/07/2026");
    expect(formatarHora(t)).toBe("19:30");
    expect(formatarDataHora(t)).toBe("30/07/2026 19:30");
  });

  it("00:30Z do dia 31 ainda é dia 30 em Brasília (o bug que motivou o módulo)", () => {
    const t = new Date("2026-07-31T00:30:00.000Z");
    expect(formatarDataHora(t)).toBe("30/07/2026 21:30");
  });

  it("usa 24h, sem AM/PM", () => {
    expect(formatarHora(new Date("2026-07-30T18:05:00.000Z"))).toBe("15:05");
  });
});

describe("hora de parede HH:MM", () => {
  it("valida formato 24h", () => {
    expect(horaValida("00:00")).toBe(true);
    expect(horaValida("23:59")).toBe(true);
    expect(horaValida("24:00")).toBe(false);
    expect(horaValida("9:30")).toBe(false);
    expect(horaValida("12:60")).toBe(false);
  });

  it("normaliza entradas humanas", () => {
    expect(normalizarHora("9:5")).toBe("09:05");
    expect(normalizarHora("0930")).toBe("09:30");
    expect(normalizarHora("14h30")).toBe("14:30");
    expect(normalizarHora("8")).toBe("08:00");
    expect(normalizarHora("99:99")).toBeNull();
    expect(normalizarHora("abc")).toBeNull();
  });

  it("converte para minutos e volta", () => {
    expect(horaEmMinutos("14:30")).toBe(870);
    expect(horaEmMinutos("xx")).toBeNull();
    expect(minutosEmHora(870)).toBe("14:30");
    expect(minutosEmHora(1500)).toBe("01:00"); // passa da meia-noite
  });

  it("calcula duração, inclusive virando o dia", () => {
    expect(duracaoEmMinutos("14:30", "18:00")).toBe(210);
    expect(duracaoEmMinutos("22:00", "02:30")).toBe(270);
    expect(duracaoEmMinutos("22:00", "xx")).toBeNull();
  });

  it("formata duração e período", () => {
    expect(formatarDuracao(390)).toBe("6h30");
    expect(formatarDuracao(45)).toBe("45min");
    expect(formatarDuracao(480)).toBe("8h");
    expect(formatarPeriodo("14:30", "18:00")).toBe("14:30–18:00 (3h30)");
  });

  it("combina data civil + hora BR num instante correto", () => {
    const t = instanteDeDataHoraBR(new Date("2026-08-15T00:00:00.000Z"), "14:30");
    // 14:30 em Brasília (UTC-3) = 17:30 UTC
    expect(t?.toISOString()).toBe("2026-08-15T17:30:00.000Z");
    expect(instanteDeDataHoraBR("2026-08-15", "99:99")).toBeNull();
  });
});

describe("tempo relativo (notificações)", () => {
  const agora = new Date("2026-07-30T12:00:00.000Z");

  it("cobre as faixas", () => {
    expect(formatarRelativo(new Date("2026-07-30T11:59:30.000Z"), agora)).toBe("agora");
    expect(formatarRelativo(new Date("2026-07-30T11:45:00.000Z"), agora)).toBe("há 15 min");
    expect(formatarRelativo(new Date("2026-07-30T09:00:00.000Z"), agora)).toBe("há 3 h");
    expect(formatarRelativo(new Date("2026-07-29T09:00:00.000Z"), agora)).toBe("ontem");
    expect(formatarRelativo(new Date("2026-07-27T09:00:00.000Z"), agora)).toBe("há 3 dias");
  });

  it("mais de uma semana cai para data absoluta", () => {
    expect(formatarRelativo(new Date("2026-07-01T09:00:00.000Z"), agora)).toBe("01/07/2026");
  });
});

/**
 * Guarda de regressão: formatação de data/hora só pode existir em lib/datetime.ts.
 * Sem isso, a próxima tela criada volta a chamar `toLocaleDateString` direto e o
 * bug de fuso reaparece em um canto do sistema.
 */
describe("nenhuma formatação de data fora de lib/datetime.ts", () => {
  const PROIBIDO = /toLocaleDateString|toLocaleTimeString|toLocaleString\(\s*["']pt-BR/;
  // `dinheiro.ts` também usa toLocaleString, mas para MOEDA — é o ponto único
  // equivalente a este módulo, e não formata data.
  const PERMITIDOS = ["src/lib/datetime.ts", "src/lib/dinheiro.ts"];

  function arquivos(dir: string): string[] {
    return readdirSync(dir).flatMap((nome) => {
      const p = path.join(dir, nome);
      return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(p) ? [p] : [];
    });
  }

  it("não há chamada direta de Intl/toLocale* nas telas e actions", () => {
    const infratores = arquivos("src")
      .filter((f) => !PERMITIDOS.includes(f.replace(/\\/g, "/")))
      .filter((f) => PROIBIDO.test(readFileSync(f, "utf8")));
    expect(infratores).toEqual([]);
  });
});

describe("diaCivilBR", () => {
  it("devolve o dia em Brasília, não em UTC", () => {
    // 16/08 00:30 UTC ainda é 15/08 em Brasília.
    expect(diaCivilBR(new Date("2026-08-16T00:30:00.000Z"))).toBe("2026-08-15");
    expect(diaCivilBR(new Date("2026-08-15T12:00:00.000Z"))).toBe("2026-08-15");
    // 03:00 UTC = 00:00 em Brasília: já é o dia novo aqui.
    expect(diaCivilBR(new Date("2026-08-16T03:00:00.000Z"))).toBe("2026-08-16");
  });

  it("entrada inválida devolve string vazia (não 'NaN-NaN-NaN')", () => {
    expect(diaCivilBR("não é data")).toBe("");
  });
});
