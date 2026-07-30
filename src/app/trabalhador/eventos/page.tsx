import Link from "next/link";
import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { formatBRL, formatData } from "@/lib/utils";
import { MapPin, CalendarDays, Users } from "lucide-react";

export const metadata = { title: "Descobrir eventos — Escala" };

export default async function DescobrirEventos() {
  const s = await requireTrabalhador();

  // RF13 — só eventos de empresas com vínculo ATIVO.
  const vinculos = await prisma.vinculo.findMany({
    where: { userId: s.sub, status: "ATIVO" },
    select: { empresaId: true },
  });
  const empresaIds = vinculos.map((v) => v.empresaId);

  const eventos = empresaIds.length
    ? await prisma.evento.findMany({
        where: { empresaId: { in: empresaIds }, status: "PUBLICADO" },
        include: {
          empresa: { select: { nome: true } },
          inscricoes: { where: { userId: s.sub }, select: { status: true } },
        },
        orderBy: { dataEvento: "asc" },
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Descobrir eventos</h1>
      <p className="mb-6 text-sm text-muted">Oportunidades das empresas às quais você está vinculado.</p>

      {empresaIds.length === 0 && (
        <Card className="text-center">
          <p className="text-sm text-muted">
            Você ainda não tem vínculos ativos. Vá em{" "}
            <Link href="/trabalhador/vinculos" className="text-brand-600 hover:underline">Vínculos</Link>{" "}
            e solicite conexão com uma empresa para ver as oportunidades.
          </p>
        </Card>
      )}

      {empresaIds.length > 0 && eventos.length === 0 && (
        <Card className="text-center text-sm text-muted">Nenhum evento disponível no momento.</Card>
      )}

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
                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatData(e.dataEvento)} {e.horaInicio && `às ${e.horaInicio}`}</div>
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
    </div>
  );
}
