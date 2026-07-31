/**
 * Geração de CSV da lista de escalados (RF11 / tela Escalar).
 * Puro (sem dependências de servidor) para permitir teste unitário.
 *
 * Padrão brasileiro: separador `;` (Excel pt-BR), BOM UTF-8 para acentuação,
 * datas `DD/MM/AAAA` e valores com vírgula decimal — planilha aberta no Brasil
 * não deve exigir "importar dados" nem mostrar 2026-08-15.
 */
import { formatarDataCivil } from "./datetime";

export interface LinhaEscala {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  funcao?: string;
  status: string;
}

/** Número em padrão pt-BR para planilha: 1234.5 -> "1.234,50". */
export function formatarNumeroBR(valor: number | string): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Escapa um campo conforme RFC 4180 (aspas, vírgulas, quebras de linha). */
export function escapeCsvField(value: string): string {
  const v = value ?? "";
  if (/[",\n\r;]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/**
 * Monta o CSV. Usa ';' como separador (padrão pt-BR / Excel Brasil) e
 * prefixa BOM UTF-8 para acentuação correta no Excel.
 */
export function gerarCsvEscala(
  evento: {
    nome: string;
    dataEvento: Date | string;
    local?: string | null;
    horaInicio?: string | null;
    valorCache?: number | string | null;
  },
  linhas: LinhaEscala[],
): string {
  const sep = ";";
  const cabecalhoEvento = [
    `Evento${sep}${escapeCsvField(evento.nome)}`,
    `Data${sep}${escapeCsvField(formatarDataCivil(evento.dataEvento))}`,
    `Hora de início${sep}${escapeCsvField(evento.horaInicio || "-")}`,
    `Local${sep}${escapeCsvField(evento.local ?? "-")}`,
    `Cachê (R$)${sep}${escapeCsvField(
      evento.valorCache === null || evento.valorCache === undefined
        ? "-"
        : formatarNumeroBR(evento.valorCache),
    )}`,
    "",
  ];

  const colunas = ["Nome", "CPF", "Telefone", "E-mail", "Função", "Status"];
  const header = colunas.join(sep);

  const corpo = linhas.map((l) =>
    [l.nome, l.cpf, l.telefone, l.email, l.funcao ?? "", l.status]
      .map(escapeCsvField)
      .join(sep),
  );

  const conteudo = [...cabecalhoEvento, header, ...corpo].join("\r\n");
  return "﻿" + conteudo; // BOM UTF-8
}
