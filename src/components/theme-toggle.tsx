"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { atributoTema, proximoTema, ROTULOS_TEMA, COOKIE_TEMA, type Tema } from "@/lib/tema";

/**
 * Alterna sistema → claro → escuro. Aplica o atributo no `<html>` na hora
 * (sem recarregar) e grava o cookie para o servidor renderizar já no tema certo
 * na próxima navegação — por isso não há flash.
 */
export function ThemeToggle({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = React.useState<Tema>(inicial);

  const alternar = () => {
    const novo = proximoTema(tema);
    setTema(novo);

    const attr = atributoTema(novo);
    const html = document.documentElement;
    if (attr) html.setAttribute("data-theme", attr);
    else html.removeAttribute("data-theme");

    // 1 ano; SameSite=Lax basta (não é dado sensível e não sai do site).
    document.cookie = `${COOKIE_TEMA}=${novo}; path=/; max-age=31536000; samesite=lax`;
  };

  const icone =
    tema === "claro" ? <Sun className="h-4 w-4" /> : tema === "escuro" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;

  return (
    <button
      type="button"
      onClick={alternar}
      data-testid="theme-toggle"
      data-tema={tema}
      title={ROTULOS_TEMA[tema]}
      aria-label={`${ROTULOS_TEMA[tema]}. Clique para usar: ${ROTULOS_TEMA[proximoTema(tema)]}`}
      className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
    >
      {icone}
      <span className="truncate">{ROTULOS_TEMA[tema].replace("Tema ", "")}</span>
    </button>
  );
}
