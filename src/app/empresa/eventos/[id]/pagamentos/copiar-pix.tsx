"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

/**
 * Copia a chave PIX para a área de transferência.
 *
 * Este é o caso de uso do toast: confirmação de uma ação **puramente de cliente**,
 * que não vai ao servidor e portanto não tem como ser confirmada por render do
 * servidor (resultado de server action usa a faixa de aviso — ADR 0004).
 */
export function CopiarPix({ chave, nome }: { chave: string; nome: string }) {
  const { sucesso, erro } = useToast();
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(chave);
      setCopiado(true);
      sucesso("Chave PIX copiada", `Chave de ${nome} na área de transferência.`);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Área de transferência bloqueada (permissão/navegador antigo): a chave já
      // está visível na tela, então o usuário ainda consegue copiar manualmente.
      erro("Não foi possível copiar", "Selecione a chave na tela e copie manualmente.");
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={copiar}
      aria-label={`Copiar chave PIX de ${nome}`}
      data-testid="copiar-pix"
    >
      {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      {copiado ? "Copiado" : "Copiar"}
    </Button>
  );
}
