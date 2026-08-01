import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estaBloqueado } from "@/lib/bloqueio";
import { ComunicacaoDoEvento } from "./comunicacao";
import { Flash } from "@/components/ui/flash";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { inscreverEvento, recusarEvento } from "@/server/actions/inscricoes";
import { formatBRL } from "@/lib/utils";
import { formatarDataCivil } from "@/lib/datetime";
import { MapPin, CalendarDays, Users, Briefcase } from "lucide-react";

export default async function DetalheEvento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; erro_op?: string }>;
}) {
  const sp = await searchParams;
  const s = await requireTrabalhador();
  const { id } = await params;
  const eventoId = Number(id);

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    include: {
      empresa: { select: { id: true, nome: true } },
      inscricoes: { where: { userId: s.sub }, select: { status: true } },
    },
  });
  if (!evento) notFound();

  // v4 item 5: bloqueado por esta empresa não acessa o evento nem por URL direta.
  if (await estaBloqueado(s.sub, evento.empresa.id)) notFound();

  // RF13 — precisa de vínculo ativo com a organizadora.
  const vinculado = await prisma.vinculo.findFirst({
    where: { userId: s.sub, empresaId: evento.empresa.id, status: "ATIVO" },
    select: { id: true },
  });

  const status = evento.inscricoes[0]?.status;
  const jaInscrito = status === "INSCRITO" || status === "ESCALADO";
  // v4 item 7: o canal de comunicação existe para quem está escalado.
  const escalado = ["ESCALADO", "PRESENTE", "FALTA"].includes(status ?? "");

  return (
    <div className="mx-auto max-w-2xl">
      <Flash searchParams={sp} caminho={`/trabalhador/eventos/${evento.id}`} />
      <Link href="/trabalhador/eventos" className="text-sm text-brand-600 hover:underline">← Voltar</Link>
      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{evento.nome}</h1>
            <p className="text-sm text-muted">{evento.empresa.nome}</p>
          </div>
          <Badge tone={evento.status === "PUBLICADO" ? "success" : "neutral"}>{evento.status}</Badge>
        </div>

        {evento.descricao && <p className="mt-4 text-sm">{evento.descricao}</p>}

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Info icon={<CalendarDays className="h-4 w-4" />} label="Data" valor={`${formatarDataCivil(evento.dataEvento)}${evento.horaInicio ? ` às ${evento.horaInicio}` : ""}`} />
          {evento.local && <Info icon={<MapPin className="h-4 w-4" />} label="Local" valor={evento.local} />}
          <Info icon={<Users className="h-4 w-4" />} label="Vagas" valor={String(evento.vagas)} />
          <Info icon={<Briefcase className="h-4 w-4" />} label="Funções" valor={evento.funcoes ?? "—"} />
        </dl>

        <p className="mt-4 text-lg font-semibold">{formatBRL(Number(evento.valorCache))} <span className="text-sm font-normal text-muted">por trabalhador</span></p>

        {evento.observacoes && (
          <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-muted dark:bg-slate-800">{evento.observacoes}</p>
        )}

        <div className="mt-6 flex gap-3">
          {!vinculado ? (
            <p className="text-sm text-amber-600">Você precisa estar vinculado à empresa para se inscrever.</p>
          ) : jaInscrito ? (
            <>
              <Badge tone="info">Você está inscrito</Badge>
              <form action={recusarEvento}>
                <input type="hidden" name="eventoId" value={evento.id} />
                <SubmitButton variant="outline" size="sm" pendingLabel="...">Cancelar inscrição</SubmitButton>
              </form>
            </>
          ) : evento.status === "PUBLICADO" ? (
            <>
              <form action={inscreverEvento}>
                <input type="hidden" name="eventoId" value={evento.id} />
                <SubmitButton pendingLabel="Inscrevendo...">Inscrever-se</SubmitButton>
              </form>
              <form action={recusarEvento}>
                <input type="hidden" name="eventoId" value={evento.id} />
                <Button type="submit" variant="ghost" size="md">Recusar</Button>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted">Inscrições encerradas.</p>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">Estar inscrito não significa estar escalado — a empresa confirma a escala.</p>
      </Card>

      <ComunicacaoDoEvento
        eventoId={evento.id}
        userId={s.sub}
        dataEvento={evento.dataEvento}
        status={evento.status}
        escalado={escalado}
      />
    </div>
  );
}

function Info({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted">{icon} {label}</dt>
      <dd className="mt-0.5 font-medium">{valor}</dd>
    </div>
  );
}
