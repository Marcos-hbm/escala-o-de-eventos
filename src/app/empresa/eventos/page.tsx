import Link from "next/link";
import { requireEmpresa, sessaoPode } from "@/lib/auth";
import { erroDeLimite } from "@/lib/assinatura";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { excluirEvento } from "@/server/actions/eventos";
import { formatBRL, formatData } from "@/lib/utils";
import { Plus, Pencil, ListChecks, Trash2, Search } from "lucide-react";
import type { Prisma, StatusEvento } from "@prisma/client";

export const metadata = { title: "Meus eventos — Escala" };

const statusTone: Record<StatusEvento, "success" | "info" | "neutral" | "danger" | "warning"> = {
  PUBLICADO: "success",
  ESCALADO: "info",
  FINALIZADO: "neutral",
  RASCUNHO: "warning",
  CANCELADO: "danger",
};

export default async function MeusEventos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; data?: string }>;
}) {
  const s = await requireEmpresa();
  const { q, data } = await searchParams;

  // v3 — RBAC do membro + cota de eventos ativos do plano.
  const podeCriar = sessaoPode(s, "evento:criar");
  const podeEditar = sessaoPode(s, "evento:editar");
  const podeExcluir = sessaoPode(s, "evento:excluir");
  const limiteAtingido = podeCriar ? await erroDeLimite(s.sub, "maxEventosAtivos") : null;

  const where: Prisma.EventoWhereInput = { empresaId: s.sub };
  if (q) where.nome = { contains: q, mode: "insensitive" };
  if (data) where.dataEvento = new Date(data);

  const eventos = await prisma.evento.findMany({
    where,
    include: { _count: { select: { inscricoes: true } } },
    orderBy: { dataEvento: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meus eventos</h1>
        {podeCriar && !limiteAtingido && (
          <Link href="/empresa/eventos/novo"><Button><Plus className="h-4 w-4" /> Novo evento</Button></Link>
        )}
      </div>

      {limiteAtingido && (
        <Card className="mb-6 border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {limiteAtingido}{" "}
          <Link href="/empresa/plano" className="underline">Ver planos</Link>
        </Card>
      )}

      {/* Filtro (RF: filtrar por nome e data) */}
      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Nome</label>
            <Input name="q" defaultValue={q ?? ""} placeholder="Buscar por nome" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Data</label>
            <Input name="data" type="date" defaultValue={data ?? ""} />
          </div>
          <Button type="submit"><Search className="h-4 w-4" /> Filtrar</Button>
        </form>
      </Card>

      {eventos.length === 0 ? (
        <Card className="text-center text-sm text-muted">Nenhum evento. Crie o primeiro em “Novo evento”.</Card>
      ) : (
        <div className="space-y-3">
          {eventos.map((e) => (
            <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{e.nome}</h2>
                  <Badge tone={statusTone[e.status]}>{e.status}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {formatData(e.dataEvento)} · {e.vagas} vaga(s) · {formatBRL(Number(e.valorCache))} · {e._count.inscricoes} inscrito(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/empresa/eventos/${e.id}/escalar`}>
                  <Button size="sm" variant="outline"><ListChecks className="h-4 w-4" /> Escalar</Button>
                </Link>
                {podeEditar && e.status !== "FINALIZADO" && (
                  <Link href={`/empresa/eventos/${e.id}/editar`}>
                    <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /> Editar</Button>
                  </Link>
                )}
                {podeExcluir && (
                  <form action={excluirEvento}>
                    <input type="hidden" name="eventoId" value={e.id} />
                    <SubmitButton size="sm" variant="ghost" pendingLabel="..." aria-label={`Excluir ${e.nome}`}>
                      <Trash2 className="h-4 w-4" />
                    </SubmitButton>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
