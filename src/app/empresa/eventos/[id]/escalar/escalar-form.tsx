"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { escalarEFinalizar } from "@/server/actions/escala";
import { initialActionState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { formatCPF } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useActionToast } from "@/components/use-action-toast";

export interface Candidato {
  userId: number;
  inscricaoId: number;
  nome: string;
  cpf: string;
  telefone: string;
  habilidades: string | null;
  jaEscalado: boolean;
  repMedia: number | null;
  repQtd: number;
  presentes: number;
  faltas: number;
  score: number;
  conflito: boolean;
}

function taxaPresenca(p: number, f: number): string {
  const t = p + f;
  return t === 0 ? "—" : `${Math.round((p / t) * 100)}%`;
}

export function EscalarForm({
  eventoId,
  candidatos,
  inteligente,
}: {
  eventoId: number;
  candidatos: Candidato[];
  /** Escalação inteligente (score/sugestões) — recurso liberado por plano. */
  inteligente: boolean;
}) {
  const [state, formAction] = useActionState(escalarEFinalizar, initialActionState);
  useActionToast(state);
  const [selecionados, setSelecionados] = useState<Set<number>>(
    () => new Set(candidatos.filter((c) => c.jaEscalado).map((c) => c.userId)),
  );

  const algumMarcado = selecionados.size > 0;
  const toggle = (id: number) =>
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selecionarTodos = () => setSelecionados(new Set(candidatos.map((c) => c.userId)));
  const selecionarSugeridos = () =>
    setSelecionados(new Set(candidatos.filter((c) => c.score > 0 && !c.conflito).map((c) => c.userId)));
  const desmarcarTodos = () => setSelecionados(new Set());

  return (
    <form action={formAction}>
      <input type="hidden" name="eventoId" value={eventoId} />
      {[...selecionados].map((id) => (
        <input key={id} type="hidden" name="userIds" value={id} />
      ))}

      {inteligente ? (
        <p className="mb-3 text-sm text-muted">
          Candidatos ordenados por <strong>desempenho</strong> (reputação + presença). ⚡ = mais recomendado.
        </p>
      ) : (
        <p className="mb-3 text-sm text-muted">
          Candidatos em ordem alfabética.{" "}
          <Link href="/empresa/plano" className="text-brand-600 hover:underline">
            Escalação inteligente (ordenar por reputação e presença) está no plano Professional
          </Link>
          .
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {inteligente && (
          <Button type="button" size="sm" onClick={selecionarSugeridos}>⚡ Selecionar sugeridos</Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={selecionarTodos}>Selecionar todos</Button>
        <Button type="button" size="sm" variant="ghost" onClick={desmarcarTodos} disabled={!algumMarcado}>
          Desmarcar todos
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-800">
            <tr>
              <th className="w-10 p-3"></th>
              <th className="p-3">Trabalhador</th>
              <th className="p-3">Reputação</th>
              <th className="p-3">Presença</th>
              {inteligente && <th className="p-3">Score</th>}
            </tr>
          </thead>
          <tbody>
            {candidatos.map((c, idx) => (
              <tr key={c.userId} className="border-t border-surface align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selecionados.has(c.userId)}
                    onChange={() => toggle(c.userId)}
                    aria-label={`Escalar ${c.nome}`}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 font-medium">
                    {inteligente && idx === 0 && c.score > 0 && <span title="Mais recomendado">⚡</span>}
                    {c.nome}
                    {c.conflito && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title="Já escalado em outro evento nesta data">
                        <AlertTriangle className="h-3 w-3" /> conflito
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">{formatCPF(c.cpf)} · {c.telefone}</div>
                  {c.habilidades && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.habilidades.split(",").map((h) => h.trim()).filter(Boolean).slice(0, 5).map((h) => (
                        <span key={h} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{h}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {c.repMedia != null ? (
                    <span className="text-amber-500">★ <span className="font-medium text-inherit">{c.repMedia.toFixed(1)}</span> <span className="text-muted">({c.repQtd})</span></span>
                  ) : (
                    <span className="text-muted">sem avaliações</span>
                  )}
                </td>
                <td className="p-3">{taxaPresenca(c.presentes, c.faltas)}</td>
                {inteligente && <td className="p-3 font-medium">{c.score.toFixed(0)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      <div className="mt-4">
        <SubmitButton disabled={!algumMarcado} pendingLabel="Finalizando...">
          Escalar e finalizar evento
        </SubmitButton>
        <p className="mt-1 text-xs text-muted">
          Selecione ao menos um trabalhador. Após finalizar, você marca presença e avalia os escalados.
        </p>
      </div>
    </form>
  );
}
