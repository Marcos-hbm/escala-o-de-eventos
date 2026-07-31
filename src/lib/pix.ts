/**
 * Chave PIX: validação, normalização e exibição.
 *
 * Funções puras (sem I/O, sem cripto) — a cifragem fica em `lib/cripto.ts` e o
 * armazenamento em `User.pixChaveCifrada`.
 *
 * Regras seguem o arranjo PIX do Banco Central: a chave é CPF, CNPJ, e-mail,
 * telefone (E.164 com +55) ou aleatória (UUID v4, "EVP").
 */
import { isValidCPF, isValidCNPJ } from "./validators-doc";

export type TipoChavePixId = "CPF" | "CNPJ" | "EMAIL" | "TELEFONE" | "ALEATORIA";

export const TIPOS_CHAVE_PIX: TipoChavePixId[] = ["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"];

export const ROTULOS_CHAVE_PIX: Record<TipoChavePixId, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  TELEFONE: "Telefone",
  ALEATORIA: "Chave aleatória",
};

export const EXEMPLOS_CHAVE_PIX: Record<TipoChavePixId, string> = {
  CPF: "000.000.000-00",
  CNPJ: "00.000.000/0000-00",
  EMAIL: "voce@exemplo.com",
  TELEFONE: "(61) 98888-0000",
  ALEATORIA: "chave de 32 caracteres do app do banco",
};

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const digitos = (s: string) => s.replace(/\D/g, "");

export interface ResultadoChavePix {
  ok: boolean;
  /** Chave normalizada para gravar (só quando `ok`). */
  valor?: string;
  /** Mensagem com o que corrigir (só quando `!ok`). */
  erro?: string;
}

/**
 * Valida e normaliza a chave conforme o tipo. A normalização é importante: a mesma
 * chave digitada como `(61) 98888-0000` ou `61988880000` tem de virar exatamente
 * o mesmo valor gravado, senão a empresa copia algo que o banco não aceita.
 */
export function normalizarChavePix(tipo: TipoChavePixId, entrada: string): ResultadoChavePix {
  const bruta = (entrada ?? "").trim();
  if (!bruta) return { ok: false, erro: "Informe a chave PIX." };

  switch (tipo) {
    case "CPF": {
      const d = digitos(bruta);
      if (d.length !== 11) return { ok: false, erro: "CPF deve ter 11 dígitos." };
      if (!isValidCPF(d)) return { ok: false, erro: "CPF inválido (dígitos verificadores não conferem)." };
      return { ok: true, valor: d };
    }
    case "CNPJ": {
      const d = digitos(bruta);
      if (d.length !== 14) return { ok: false, erro: "CNPJ deve ter 14 dígitos." };
      if (!isValidCNPJ(d)) return { ok: false, erro: "CNPJ inválido (dígitos verificadores não conferem)." };
      return { ok: true, valor: d };
    }
    case "EMAIL": {
      const e = bruta.toLowerCase();
      if (!RE_EMAIL.test(e)) return { ok: false, erro: "E-mail inválido." };
      if (e.length > 77) return { ok: false, erro: "E-mail excede o limite de 77 caracteres do PIX." };
      return { ok: true, valor: e };
    }
    case "TELEFONE": {
      const d = digitos(bruta);
      // Aceita com ou sem o 55 na frente; grava no formato E.164 (+55DDDNÚMERO).
      const semPais = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
      if (semPais.length !== 10 && semPais.length !== 11) {
        return { ok: false, erro: "Telefone deve ter DDD + número (10 ou 11 dígitos)." };
      }
      return { ok: true, valor: `+55${semPais}` };
    }
    case "ALEATORIA": {
      const v = bruta.toLowerCase();
      if (!RE_UUID.test(v)) {
        return { ok: false, erro: "Chave aleatória deve ser o código no formato UUID fornecido pelo seu banco." };
      }
      return { ok: true, valor: v };
    }
  }
}

/**
 * Exibição mascarada, para o trabalhador confirmar qual chave está cadastrada sem
 * expor o valor inteiro em tela (e sem servir de vetor para quem olha por cima do
 * ombro). A empresa, no fechamento, vê a chave completa — com auditoria.
 */
export function mascararChavePix(tipo: TipoChavePixId, valor: string): string {
  if (!valor) return "—";
  switch (tipo) {
    case "CPF":
      return `***.${valor.slice(3, 6)}.${valor.slice(6, 9)}-**`;
    case "CNPJ":
      return `**.${valor.slice(2, 5)}.${valor.slice(5, 8)}/****-**`;
    case "EMAIL": {
      const [usuario, dominio = ""] = valor.split("@");
      const visivel = usuario.slice(0, 2);
      return `${visivel}${"*".repeat(Math.max(1, usuario.length - 2))}@${dominio}`;
    }
    case "TELEFONE": {
      const d = digitos(valor);
      return `+55 (${d.slice(2, 4)}) *****-${d.slice(-4)}`;
    }
    case "ALEATORIA":
      return `${valor.slice(0, 8)}…${valor.slice(-4)}`;
  }
}

/** Exibição amigável da chave completa (para a empresa copiar). */
export function formatarChavePix(tipo: TipoChavePixId, valor: string): string {
  switch (tipo) {
    case "CPF":
      return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    case "CNPJ":
      return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    case "TELEFONE": {
      const d = digitos(valor);
      const ddd = d.slice(2, 4);
      const resto = d.slice(4);
      return resto.length === 9
        ? `+55 (${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`
        : `+55 (${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
    }
    default:
      return valor;
  }
}
