import { trocarPlano } from "@/server/actions/plano";
import { SubmitButton } from "@/components/submit-button";
import { rotuloPlano, type PlanoId } from "@/lib/planos";

/**
 * Troca de plano (sem cobrança — ver `server/actions/plano.ts`). Só é renderizado
 * para quem tem a permissão `plano:gerenciar`.
 *
 * **Componente de servidor de propósito.** O `<form action={serverAction}>` fica no
 * servidor e apenas o botão é cliente (para o estado "Alterando..."). Medido no
 * mesmo fluxo (12 execuções cada): formulário dentro de client component com
 * `useActionState` deixava a tela no estado anterior em 3 de 12; formulário simples
 * em client component, 1 de 12; formulário renderizado no servidor, 0 de 12. O
 * resultado volta como aviso renderizado no servidor (ADR 0004).
 */
export function TrocarPlanoForm({ destino, atual }: { destino: PlanoId; atual: PlanoId }) {
  const ehAtual = destino === atual;

  return (
    <form action={trocarPlano} className="mt-4">
      <input type="hidden" name="plano" value={destino} />
      <SubmitButton
        size="sm"
        variant={ehAtual ? "secondary" : "primary"}
        disabled={ehAtual}
        pendingLabel="Alterando..."
      >
        {ehAtual ? "Plano atual" : `Mudar para ${rotuloPlano(destino)}`}
      </SubmitButton>
    </form>
  );
}
