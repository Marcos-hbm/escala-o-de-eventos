import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";
import { formatarDataCivil } from "@/lib/datetime";
import { Flash } from "@/components/ui/flash";
import { AvaliarEmpresa } from "./avaliar-empresa";

export const metadata = { title: "Histórico — Escala" };

const PARTICIPOU = ["ESCALADO", "PRESENTE", "FALTA"];

const rotulo: Record<string, { texto: string; tone: "success" | "info" | "neutral" | "danger" }> = {
  ESCALADO: { texto: "Escalado", tone: "success" },
  PRESENTE: { texto: "Presente", tone: "success" },
  INSCRITO: { texto: "Inscrito", tone: "info" },
  RECUSADO_EMPRESA: { texto: "Não selecionado", tone: "neutral" },
  CANCELADO_TRABALHADOR: { texto: "Cancelado por você", tone: "neutral" },
  FALTA: { texto: "Falta", tone: "danger" },
};

export default async function Historico({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; erro_op?: string }>;
}) {
  const s = await requireTrabalhador();
  const sp = await searchParams;

  // RF12 — histórico de participações.
  const inscricoes = await prisma.inscricao.findMany({
    where: { userId: s.sub },
    include: { evento: { include: { empresa: { select: { nome: true } } } } },
    orderBy: { evento: { dataEvento: "desc" } },
  });

  // Avaliações já feitas por este trabalhador (por evento) para pré-preencher.
  const minhasAvaliacoes = await prisma.avaliacao.findMany({
    where: { userId: s.sub, autor: "TRABALHADOR" },
    select: { eventoId: true, nota: true },
  });
  const notaPorEvento = new Map(minhasAvaliacoes.map((a) => [a.eventoId, a.nota]));

  return (
    <div>
      <Flash searchParams={sp} caminho="/trabalhador/historico" />
      <h1 className="text-2xl font-bold">Histórico de participações</h1>
      <p className="mb-6 text-sm text-muted">Todos os eventos aos quais você se candidatou.</p>

      {inscricoes.length === 0 ? (
        <Card className="text-sm text-muted">Você ainda não participou de nenhum evento.</Card>
      ) : (
        <div className="space-y-2">
          {inscricoes.map((i) => {
            const r = rotulo[i.status] ?? { texto: i.status, tone: "neutral" as const };
            const podeAvaliar = i.evento.status === "FINALIZADO" && PARTICIPOU.includes(i.status);
            return (
              <Card key={i.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{i.evento.nome}</p>
                    <p className="text-xs text-muted">
                      {i.evento.empresa.nome} · {formatarDataCivil(i.evento.dataEvento)} · {formatBRL(Number(i.evento.valorCache))}
                    </p>
                  </div>
                  <Badge tone={r.tone}>{r.texto}</Badge>
                </div>
                {podeAvaliar && (
                  <AvaliarEmpresa eventoId={i.evento.id} notaAtual={notaPorEvento.get(i.evento.id) ?? null} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
