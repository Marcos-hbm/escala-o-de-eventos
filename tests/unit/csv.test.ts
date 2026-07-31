import { describe, it, expect } from "vitest";
import { escapeCsvField, formatarNumeroBR, gerarCsvEscala } from "@/lib/csv";

describe("escapeCsvField", () => {
  it("não altera campos simples", () => {
    expect(escapeCsvField("Ana")).toBe("Ana");
  });
  it("envolve em aspas quando há separador, aspas ou quebra", () => {
    expect(escapeCsvField("Silva; Souza")).toBe('"Silva; Souza"');
    expect(escapeCsvField('Diz "oi"')).toBe('"Diz ""oi"""');
    expect(escapeCsvField("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });
});

describe("gerarCsvEscala", () => {
  it("gera CSV com BOM, cabeçalho do evento e linhas", () => {
    const csv = gerarCsvEscala(
      { nome: "Festival", dataEvento: "2026-08-15", local: "Parque" },
      [
        { nome: "Ana Souza", cpf: "529.982.247-25", telefone: "61988880001", email: "ana@x.com", funcao: "Garçom", status: "ESCALADO" },
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true); // BOM UTF-8
    expect(csv).toContain("Evento;Festival");
    expect(csv).toContain("Nome;CPF;Telefone;E-mail;Função;Status");
    expect(csv).toContain("Ana Souza;529.982.247-25;61988880001;ana@x.com;Garçom;ESCALADO");
  });

  it("exporta em padrão brasileiro: data DD/MM/AAAA e valor com vírgula decimal", () => {
    const csv = gerarCsvEscala(
      {
        nome: "Festival",
        dataEvento: new Date("2026-08-15T00:00:00.000Z"),
        local: "Parque",
        horaInicio: "16:00",
        valorCache: 1234.5,
      },
      [],
    );
    // Planilha aberta no Brasil não deve receber 2026-08-15 nem 1234.50.
    expect(csv).toContain("Data;15/08/2026");
    expect(csv).toContain("Hora de início;16:00");
    // O valor sai entre aspas porque contém vírgula decimal — escape conforme
    // RFC 4180, que o Excel pt-BR lê como número.
    expect(csv).toContain('Cachê (R$);"1.234,50"');
  });

  it("campos ausentes viram '-' em vez de vazio ambíguo", () => {
    const csv = gerarCsvEscala({ nome: "X", dataEvento: "2026-08-15", local: null }, []);
    expect(csv).toContain("Hora de início;-");
    expect(csv).toContain("Local;-");
    expect(csv).toContain("Cachê (R$);-");
  });
});

describe("formatarNumeroBR", () => {
  it("usa ponto de milhar e vírgula decimal, com 2 casas fixas", () => {
    expect(formatarNumeroBR(1234.5)).toBe("1.234,50");
    expect(formatarNumeroBR("180")).toBe("180,00");
    expect(formatarNumeroBR(0)).toBe("0,00");
  });

  it("entrada inválida devolve vazio (não 'NaN' na planilha)", () => {
    expect(formatarNumeroBR("abc")).toBe("");
  });
});
