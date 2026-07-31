import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmpresa, sessaoPode } from "@/lib/auth";
import { recursoLiberado } from "@/lib/assinatura";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Estrelas } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { reabrirEvento } from "@/server/actions/escala";
import { marcarPresenca } from "@/server/actions/presenca";
import { reputacoesDeTrabalhadores, presencasDeTrabalhadores, conflitosDeAgenda } from "@/lib/reputacao";
import { scorePrioridade } from "@/lib/stats";
import { EscalarForm, type Candidato } from "./escalar-form";
import { AvaliarTrabalhador } from "./avaliar-trabalhador";
import { formatarDataCivil } from "@/lib/datetime";
import { Download, CheckCircle2, XCircle } from "lucide-react";

export const metadata = { title: "Escalar — Escala" };

export default async function EscalarPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireEmpresa();
  const { id } = await params;
  const eventoId = Number(id);

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    include: {
      inscricoes: {
        where: { status: { in: ["INSCRITO", "ESCALADO", "PRESENTE", "FALTA"] } },
        include: { user: { select: { id: true, nome: true, cpf: true, telefone: true, habilidades: true } } },
      },
      avaliacoes: { where: { autor: "EMPRESA" }, select: { userId: true, nota: true } },
    },
  });
  if (!evento || evento.empresaId !== s.sub) notFound();

  // v3 — o que este membro pode fazer aqui (RBAC) e o que o plano libera.
  const podeEscalar = sessaoPode(s, "escala:gerenciar");
  const podeMarcarPresenca = sessaoPode(s, "presenca:marcar");
  const podeAvaliar = sessaoPode(s, "avaliacao:registrar");
  const escalacaoInteligente = await recursoLiberado(s.sub, "escalacaoInteligente");

  const finalizado = evento.status === "FINALIZADO";
  const userIds = evento.inscricoes.map((i) => i.user.id);

  const [reps, press, conflitos] = await Promise.all([
    reputacoesDeTrabalhadores(userIds),
    presencasDeTrabalhadores(userIds),
    conflitosDeAgenda(userIds, evento.dataEvento, eventoId),
  ]);
  const notaPorUser = new Map(evento.avaliacoes.map((a) => [a.userId, a.nota]));

  const candidatos: Candidato[] = evento.inscricoes.map((i) => {
    const rep = reps.get(i.user.id) ?? { media: null, qtd: 0 };
    const pres = press.get(i.user.id) ?? { presentes: 0, faltas: 0 };
    return {
      userId: i.user.id,
      inscricaoId: i.id,
      nome: i.user.nome,
      cpf: i.user.cpf,
      telefone: i.user.telefone,
      habilidades: i.user.habilidades,
      jaEscalado: ["ESCALADO", "PRESENTE", "FALTA"].includes(i.status),
      repMedia: rep.media,
      repQtd: rep.qtd,
      presentes: pres.presentes,
      faltas: pres.faltas,
      score: scorePrioridade({ reputacaoMedia: rep.media, presentes: pres.presentes, faltas: pres.faltas }),
      conflito: conflitos.has(i.user.id),
    };
  });
  // Escalação inteligente (recurso de plano): maior score primeiro; sem
  // histórico vai ao fim. Sem o recurso, a lista é alfabética (escalação manual).
  candidatos.sort((a, b) =>
    escalacaoInteligente ? b.score - a.score || a.nome.localeCompare(b.nome) : a.nome.localeCompare(b.nome),
  );

  const escalados = evento.inscricoes
    .filter((i) => ["ESCALADO", "PRESENTE", "FALTA"].includes(i.status))
    .sort((a, b) => a.user.nome.localeCompare(b.user.nome));

  return (
    <div>
      <Link href="/empresa/eventos" className="text-sm text-brand-600 hover:underline">← Voltar</Link>
      <div className="mb-4 mt-3 flex items-center gap-2">
        <h1 className="text-2xl font-bold">Escalar — {evento.nome}</h1>
        <Badge tone={finalizado ? "neutral" : "success"}>{evento.status}</Badge>
      </div>
      <p className="mb-6 text-sm text-muted">{formatarDataCivil(evento.dataEvento)} · {candidatos.length} candidato(s)</p>

      {candidatos.length === 0 ? (
        <Card className="text-sm text-muted">Nenhum trabalhador se inscreveu neste evento ainda.</Card>
      ) : finalizado ? (
        <Card>
          <p className="mb-4 text-sm">
            Evento finalizado. {escalados.length} trabalhador(es) escalado(s).{" "}
            {podeMarcarPresenca || podeAvaliar
              ? "Marque a presença e avalie."
              : "Seu papel permite apenas acompanhar presença e avaliações (somente leitura)."}
          </p>
          <div className="mb-4 overflow-x-auto rounded-lg border border-surface">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-800">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Presença</th>
                  <th className="p-3">Avaliação</th>
                </tr>
              </thead>
              <tbody>
                {escalados.map((i) => (
                  <tr key={i.id} className="border-t border-surface align-middle">
                    <td className="p-3">
                      <div className="font-medium">{i.user.nome}</div>
                      <div className="text-xs text-muted">{i.user.telefone}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {i.status === "PRESENTE" && <Badge tone="success">Presente</Badge>}
                        {i.status === "FALTA" && <Badge tone="danger">Falta</Badge>}
                        {podeMarcarPresenca && (
                        <form action={marcarPresenca}>
                          <input type="hidden" name="inscricaoId" value={i.id} />
                          <input type="hidden" name="presente" value="true" />
                          <SubmitButton size="sm" variant="ghost" pendingLabel="..." aria-label={`Presença de ${i.user.nome}`}>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </SubmitButton>
                        </form>
                        )}
                        {podeMarcarPresenca && (
                        <form action={marcarPresenca}>
                          <input type="hidden" name="inscricaoId" value={i.id} />
                          <input type="hidden" name="presente" value="false" />
                          <SubmitButton size="sm" variant="ghost" pendingLabel="..." aria-label={`Falta de ${i.user.nome}`}>
                            <XCircle className="h-4 w-4 text-red-600" />
                          </SubmitButton>
                        </form>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {podeAvaliar ? (
                        <AvaliarTrabalhador eventoId={eventoId} userId={i.user.id} notaAtual={notaPorUser.get(i.user.id) ?? null} />
                      ) : (
                        <Estrelas media={notaPorUser.get(i.user.id) ?? null} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <a href={`/empresa/eventos/${eventoId}/lista`}>
              <Button variant="primary"><Download className="h-4 w-4" /> Baixar lista (CSV)</Button>
            </a>
            {podeEscalar && (
              <form action={reabrirEvento}>
                <input type="hidden" name="eventoId" value={eventoId} />
                <SubmitButton variant="outline" pendingLabel="...">Reabrir para reescalar</SubmitButton>
              </form>
            )}
          </div>
        </Card>
      ) : podeEscalar ? (
        <Card>
          <EscalarForm eventoId={eventoId} candidatos={candidatos} inteligente={escalacaoInteligente} />
        </Card>
      ) : (
        <Card>
          <p className="mb-3 text-sm text-muted">
            Seu papel permite apenas acompanhar esta escala (somente leitura).
          </p>
          <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-700">
            {candidatos.map((c) => (
              <li key={c.userId} className="flex items-center justify-between py-2">
                <span className="font-medium">{c.nome}</span>
                <Estrelas media={c.repMedia} qtd={c.repQtd} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
