import Link from "next/link";
import { requireEmpresa, sessaoPode } from "@/lib/auth";
import { erroDeLimite } from "@/lib/assinatura";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { excluirEvento } from "@/server/actions/eventos";
import { formatBRL } from "@/lib/utils";
import { formatarDataCivil } from "@/lib/datetime";
import { lerParametrosPagina, montarPagina } from "@/lib/paginacao";
import { Paginacao } from "@/components/ui/paginacao";
import { EmptyState } from "@/components/ui/empty-state";
import { Flash } from "@/components/ui/flash";
import { Plus, Pencil, ListChecks, Trash2, Search, CalendarDays, Wallet, MessageSquare } from "lucide-react";
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
  searchParams: Promise<{ q?: string; data?: string; pagina?: string; tamanho?: string; aviso?: string; erro_op?: string }>;
}) {
  const s = await requireEmpresa();
  const sp = await searchParams;
  const { q, data, pagina, tamanho } = sp;
  const params = lerParametrosPagina({ pagina, tamanho });

  // v3 — RBAC do membro + cota de eventos ativos do plano.
  const podeCriar = sessaoPode(s, "evento:criar");
  const podeEditar = sessaoPode(s, "evento:editar");
  const podeExcluir = sessaoPode(s, "evento:excluir");
  const podeFinanceiro = sessaoPode(s, "financeiro:ver");
  const podeComunicacao = sessaoPode(s, "comunicacao:responder");
  const limiteAtingido = podeCriar ? await erroDeLimite(s.sub, "maxEventosAtivos") : null;

  const filtrado = Boolean(q || data);
  const listaEventos = await listaDeEventos({
    empresaId: s.sub,
    q,
    data,
    params,
    filtrado,
    podeEditar,
    podeExcluir,
    podeCriar,
    podeFinanceiro,
    podeComunicacao,
    limiteAtingido,
  });

  return (
    <div>
      <div className="mb-4">
        <Flash searchParams={sp} caminho="/empresa/eventos" />
      </div>
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

      {listaEventos}
    </div>
  );
}

/**
 * Consulta + lista, renderizadas no corpo da página (sem `<Suspense>`).
 *
 * Tentamos streaming aqui (Suspense com skeleton) e a lista **deixava de refletir
 * mutações**: após `excluirEvento` + `revalidatePath`, o registro saía do banco e a
 * tela continuava mostrando o evento (medido: 5 de 6 execuções). Correção acima de
 * enfeite — a consulta volta para o corpo da página, que revalida corretamente.
 * O `loading.tsx` de segmento também não serve nesta rota: envolveria
 * `/empresa/eventos/[id]/*` e o shell 200 sairia antes do `notFound()`, quebrando
 * o 404 de IDOR.
 */
async function listaDeEventos({
  empresaId,
  q,
  data,
  params,
  filtrado,
  podeEditar,
  podeExcluir,
  podeCriar,
  podeFinanceiro,
  podeComunicacao,
  limiteAtingido,
}: {
  empresaId: number;
  q?: string;
  data?: string;
  params: ReturnType<typeof lerParametrosPagina>;
  filtrado: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeCriar: boolean;
  podeFinanceiro: boolean;
  podeComunicacao: boolean;
  limiteAtingido: string | null;
}) {
  const where: Prisma.EventoWhereInput = { empresaId };
  if (q) where.nome = { contains: q, mode: "insensitive" };
  if (data) where.dataEvento = new Date(data);

  // Paginação no banco: sem `take`, uma empresa com milhares de eventos
  // carregaria tudo em memória a cada acesso.
  const [itens, total] = await Promise.all([
    prisma.evento.findMany({
      where,
      include: { _count: { select: { inscricoes: true } } },
      orderBy: { dataEvento: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.evento.count({ where }),
  ]);
  const paginaEventos = montarPagina(itens, total, params);
  const eventos = paginaEventos.itens;

  return (
    <>
      {eventos.length === 0 ? (
        filtrado ? (
          <EmptyState
            icone={<Search className="h-6 w-6" />}
            titulo="Nenhum evento encontrado com esses filtros"
            descricao="Ajuste o nome ou a data da busca para ver outros eventos."
            acao={{ href: "/empresa/eventos", rotulo: "Limpar filtros" }}
          />
        ) : (
          <EmptyState
            icone={<CalendarDays className="h-6 w-6" />}
            titulo="Você ainda não criou eventos"
            descricao="Publique um evento para que os trabalhadores vinculados possam se candidatar."
            acao={podeCriar && !limiteAtingido ? { href: "/empresa/eventos/novo", rotulo: "Criar primeiro evento" } : undefined}
          />
        )
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
                  {formatarDataCivil(e.dataEvento)} · {e.vagas} vaga(s) · {formatBRL(Number(e.valorCache))} · {e._count.inscricoes} inscrito(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/empresa/eventos/${e.id}/escalar`}>
                  <Button size="sm" variant="outline"><ListChecks className="h-4 w-4" /> Escalar</Button>
                </Link>
                {/* v4 item 8: painel do coordenador para conduzir o evento ao vivo. */}
                {podeComunicacao && e.status !== "CANCELADO" && (
                  <Link href={`/empresa/eventos/${e.id}/painel`}>
                    <Button size="sm" variant="outline"><MessageSquare className="h-4 w-4" /> Painel</Button>
                  </Link>
                )}
                {/* v4 item 2: o fluxo pós-evento começa aqui. */}
                {podeFinanceiro && e.status === "FINALIZADO" && (
                  <Link href={`/empresa/eventos/${e.id}/pagamentos`}>
                    <Button size="sm"><Wallet className="h-4 w-4" /> Finalizar pagamentos</Button>
                  </Link>
                )}
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

      <Paginacao
        pagina={paginaEventos}
        base="/empresa/eventos"
        filtros={{ q, data }}
        singular="evento"
      />
    </>
  );
}
