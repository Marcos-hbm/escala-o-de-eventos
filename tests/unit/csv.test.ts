import { describe, it, expect } from "vitest";
import { escapeCsvField, gerarCsvEscala } from "@/lib/csv";

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
});
