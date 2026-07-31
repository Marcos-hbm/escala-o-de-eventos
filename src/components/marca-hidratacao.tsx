"use client";

import * as React from "react";

/**
 * Marcador de interatividade: só aparece depois que o React monta no cliente.
 *
 * Fica no layout raiz como **folha** (não envolve `children`), então nenhuma parte
 * da árvore de servidor passa a ser subárvore de cliente. Serve a dois propósitos:
 * diagnóstico e, principalmente, permitir que os testes E2E só interajam quando a
 * app está de fato interativa — clique dentro da janela de hidratação é consumido
 * sem efeito visível (a server action roda, a tela não atualiza).
 */
export function MarcaHidratacao() {
  const [hidratado, setHidratado] = React.useState(false);
  React.useEffect(() => setHidratado(true), []);
  if (!hidratado) return null;
  return <span hidden data-hidratado="true" />;
}
