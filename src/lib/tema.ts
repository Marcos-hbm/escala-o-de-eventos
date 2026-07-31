/**
 * Tema claro/escuro.
 *
 * A preferência é persistida em **cookie** (não em localStorage) para o servidor
 * já renderizar o HTML com o tema correto: com localStorage o primeiro paint sai
 * no tema errado e pisca (FOUC). O cookie não é `httpOnly` de propósito — o
 * toggle no cliente precisa escrevê-lo — e não guarda nada sensível.
 *
 * `sistema` = seguir o SO (`prefers-color-scheme`), que é o padrão.
 */

export const COOKIE_TEMA = "escala_tema";
export const TEMAS = ["sistema", "claro", "escuro"] as const;
export type Tema = (typeof TEMAS)[number];

export function ehTema(valor: unknown): valor is Tema {
  return typeof valor === "string" && (TEMAS as readonly string[]).includes(valor);
}

export function temaOuPadrao(valor: string | undefined | null): Tema {
  return ehTema(valor) ? valor : "sistema";
}

/**
 * Valor do atributo `data-theme` no `<html>`. Para `sistema` devolve `undefined`:
 * sem o atributo, quem decide é o `@media (prefers-color-scheme)` do CSS.
 */
export function atributoTema(tema: Tema): "light" | "dark" | undefined {
  if (tema === "claro") return "light";
  if (tema === "escuro") return "dark";
  return undefined;
}

export const ROTULOS_TEMA: Record<Tema, string> = {
  sistema: "Tema do sistema",
  claro: "Tema claro",
  escuro: "Tema escuro",
};

/** Próximo tema no ciclo do botão: sistema → claro → escuro → sistema. */
export function proximoTema(atual: Tema): Tema {
  const i = TEMAS.indexOf(atual);
  return TEMAS[(i + 1) % TEMAS.length];
}
