import Link from "next/link";
import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";
import { formatarDataCivil } from "@/lib/datetime";
import { MapPin, CalendarDays, Users, Link2 } from "lucide-react";
import { lerParametrosPagina, montarPagina } from "@/lib/paginacao";
import { Paginacao } from "@/components/ui/paginacao";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Descobrir eventos — Escala" };

export default async function DescobrirEventos({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; tamanho?: string }>;
}) {
  const s = await requireTrabalhador();
  const { pagina, tamanho } = await searchParams;
  const params = lerParametrosPagina({ pagina, tamanho });

  // RF13 — só eventos de empresas com vínculo ATIVO.
  const vinculos = await prisma.vinculo.findMany({
    where: { userId: s.sub, status: "ATIVO" },
    select: { empresaId: true },
  });
  const empresaIds = vinculos.map((v) => v.empresaId);
  const vagas = empresaIds.length
    ? await vagasDisponiveis({ userId: s.sub, empresaIds, params })
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">Descobrir eventos</h1>
      <p className="mb-6 text-sm text-muted">Oportunidades das empresas às quais você está vinculado.</p>

      {empresaIds.length === 0 && (
        <EmptyState
          icone={<Link2 className="h-6 w-6" />}
          titulo="Você ainda não tem vínculos ativos"
          descricao="As oportunidades aparecem aqui depois que uma empresa aceitar seu vínculo (RF13)."
          acao={{ href: "/trabalhador/vinculos", rotulo: "Buscar empresas" }}
        />
      )}

      {empresaIds.length > 0 && vagas}
    </div>
  );
}

/**
 * Consulta + grade de vagas no corpo da página (sem `<Suspense>`): ver comentário
 * equivalente em `app/empresa/eventos/page.tsx` — dentro de Suspense a lista
 * deixava de refletir mutações revalidadas por server action.
 */
async function vagasDisponiveis({
  userId,
  empresaIds,
  params,
}: {
  userId: number;
  empresaIds: number[];
  params: ReturnType<typeof lerParametrosPagina>;
}) {
  const where = { empresaId: { in: empresaIds }, status: "PUBLICADO" as const };
  const [itens, total] = await Promise.all([
    prisma.evento.findMany({
      where,
      include: {
        empresa: { select: { nome: true } },
        inscricoes: { where: { userId }, select: { status: true } },
      },
      orderBy: { dataEvento: "asc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.evento.count({ where }),
  ]);
  const paginaEventos = montarPagina(itens, total, params);
  const eventos = paginaEventos.itens;

  if (eventos.length === 0) {
    return (
      <EmptyState
        icone={<CalendarDays className="h-6 w-6" />}
        titulo="Nenhuma vaga aberta agora"
        descricao="Quando uma das empresas às quais você está vinculado publicar um evento, ele aparece aqui e você recebe notificação."
      />
    );
  }

  return (
    <>

      <div className="grid gap-4 sm:grid-cols-2">
        {eventos.map((e) => {
          const inscricao = e.inscricoes[0]?.status;
          return (
            <Card key={e.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{e.nome}</h2>
                  <p className="text-xs text-muted">{e.empresa.nome}</p>
                </div>
                {inscricao === "INSCRITO" && <Badge tone="info">Inscrito</Badge>}
                {inscricao === "CANCELADO_TRABALHADOR" && <Badge tone="neutral">Recusado</Badge>}
              </div>
              <dl className="mt-3 space-y-1 text-sm text-muted">
                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatarDataCivil(e.dataEvento)} {e.horaInicio && `às ${e.horaInicio}`}</div>
                {e.local && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {e.local}</div>}
                <div className="flex items-center gap-2"><Users className="h-4 w-4" /> {e.vagas} vaga(s)</div>
              </dl>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium">{formatBRL(Number(e.valorCache))}</span>
                <Link href={`/trabalhador/eventos/${e.id}`} className="text-sm text-brand-600 hover:underline">
                  Ver detalhes →
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <Paginacao pagina={paginaEventos} base="/trabalhador/eventos" filtros={{}} singular="evento" />
    </>
  );
}
