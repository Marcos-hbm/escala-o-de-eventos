import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes Tailwind resolvendo conflitos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata Decimal/number como moeda BRL. */
export function formatBRL(valor: number | string): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata Date para dd/mm/aaaa. */
export function formatData(data: Date | string): string {
  const d = typeof data === "string" ? new Date(data) : data;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Aplica máscara visual de CPF: 000.000.000-00 */
export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** Aplica máscara visual de CNPJ: 00.000.000/0000-00 */
export function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

/** Remove tudo que não é dígito. */
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}
