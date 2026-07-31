"use client";

import { useState } from "react";
import { avaliarTrabalhador } from "@/server/actions/avaliacoes";
import { StarRating } from "@/components/star-rating";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { CRITERIOS, mediaExata, type CriterioId } from "@/lib/domain/avaliacao";

/**
 * Avaliação por critérios (v4 item 3).
 *
 * Cliente por causa das estrelas (estado local por critério) e da prévia da nota
 * geral; o envio é server action simples, com o resultado voltando como aviso
 * renderizado no servidor (ADR 0004).
 *
 * Fica fechado por padrão: cinco critérios abertos em cada linha da tabela viraria
 * um paredão. O resumo mostra a nota já registrada.
 */
export function AvaliarTrabalhador({
  eventoId,
  userId,
  notaAtual,
  notasAtuais,
}: {
  eventoId: number;
  userId: number;
  notaAtual: number | null;
  notasAtuais?: Partial<Record<CriterioId, number | null>>;
}) {
  const [aberto, setAberto] = useState(false);
  const [notas, setNotas] = useState<Partial<Record<CriterioId, number>>>(() => {
    const inicial: Partial<Record<CriterioId, number>> = {};
    for (const c of CRITERIOS) {
      const v = notasAtuais?.[c.id];
      if (typeof v === "number") inicial[c.id] = v;
    }
    return inicial;
  });

  const previa = mediaExata(notas);

  if (!aberto) {
    return (
      <div className="flex items-center gap-2">
        {notaAtual != null ? (
          <span className="text-sm" title="Nota geral registrada">
            <span className="text-amber-500">★</span> {notaAtual}/5
          </span>
        ) : (
          <span className="text-xs text-muted">sem avaliação</span>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setAberto(true)}>
          {notaAtual != null ? "Reavaliar" : "Avaliar"}
        </Button>
      </div>
    );
  }

  return (
    <form action={avaliarTrabalhador} className="space-y-2" data-testid="form-avaliacao">
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="userId" value={userId} />
      {CRITERIOS.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm" title={c.ajuda}>{c.rotulo}</span>
          <StarRating
            name={c.id}
            defaultValue={notas[c.id] ?? 0}
            rotulo={c.rotulo}
            onChange={(v) => setNotas((prev) => ({ ...prev, [c.id]: v }))}
          />
        </div>
      ))}

      <div>
        <Input name="comentario" placeholder="Comentário (opcional)" maxLength={500} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton size="sm" pendingLabel="Salvando...">Salvar avaliação</SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        {previa != null && (
          <span className="text-xs text-muted" data-testid="previa-nota">
            Nota geral: {previa.toFixed(1).replace(".", ",")}
          </span>
        )}
      </div>
    </form>
  );
}
