/**
 * Validação algorítmica de CPF e CNPJ (dígitos verificadores).
 * Isolado das schemas Zod para permitir teste unitário direto.
 */

export function isValidCPF(cpfRaw: string): boolean {
  const cpf = cpfRaw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  // Rejeita sequências repetidas (000..., 111..., etc).
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const dig1 = calcDigito(cpf.slice(0, 9), 10);
  const dig2 = calcDigito(cpf.slice(0, 10), 11);
  return dig1 === Number(cpf[9]) && dig2 === Number(cpf[10]);
}

export function isValidCNPJ(cnpjRaw: string): boolean {
  const cnpj = cnpjRaw.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigito = (base: string): number => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dig1 = calcDigito(cnpj.slice(0, 12));
  const dig2 = calcDigito(cnpj.slice(0, 13));
  return dig1 === Number(cnpj[12]) && dig2 === Number(cnpj[13]);
}

/** Verifica idade mínima (RF01 — trabalhador). Retorna idade em anos. */
export function idade(dataNascimento: Date, hoje = new Date()): number {
  let anos = hoje.getFullYear() - dataNascimento.getFullYear();
  const m = hoje.getMonth() - dataNascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dataNascimento.getDate())) {
    anos--;
  }
  return anos;
}
