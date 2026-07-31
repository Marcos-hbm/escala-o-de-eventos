import Link from "next/link";
import { papelDaSessao, requireEmpresa, sessaoPode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reputacoesDeTrabalhadores } from "@/lib/reputacao";
import { resumirCriterios, destaques } from "@/lib/domain/avaliacao";
import { formatarDataHora } from "@/lib/datetime";
import { Card, Badge } from "@/components/ui/card";
import { Estrelas } from "@/components/ui/stat";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Flash } from "@/components/ui/flash";
import { AvisoNegado } from "@/components/aviso-negado";
import { desbloquearTrabalhador, favoritarTrabalhador } from "@/server/actions/relacionamento";
import { BloquearForm } from "./bloquear-form";
import { Star, Ban, Users } from "lucide-react";

export const metadata = { title: "Relacionamento — Escala" };

/**
 * v4 — Favoritos e bloqueios (itens 4 e 5).
 *
 * Uma tela só para a relação com os trabalhadores: quem a empresa quer de volta e
 * quem não deve mais aparecer nas vagas. O bloqueio mostra o motivo registrado,
 * porque é o que permite rever a decisão.
 */
export default async function Relacionamento({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; erro_op?: string; negado?: string }>;
}) {
  const s = await requireEmpresa();
  const sp = await searchParams;

  const podeGerenciar = sessaoPode(s, "relacionamento:gerenciar");
  const podeDesbloquear = sessaoPode(s, "equipe:gerenciar");

  const [favoritos, bloqueios] = await Promise.all([
    prisma.trabalhadorFavorito.findMany({
      where: { empresaId: s.sub },
      include: {
        user: { select: { id: true, nome: true, fotoPath: true, cidade: true, habilidades: true } },
        criadoPor: { select: { nome: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trabalhadorBloqueio.findMany({
      where: { empresaId: s.sub },
      include: {
        user: { select: { id: true, nome: true, fotoPath: true } },
        aplicadoPor: { select: { nome: true } },
        removidoPor: { select: { nome: true } },
      },
      orderBy: [{ removidoEm: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const idsFavoritos = favoritos.map((f) => f.user.id);
  const [reputacoes, avaliacoes] = await Promise.all([
    reputacoesDeTrabalhadores(idsFavoritos),
    prisma.avaliacao.findMany({
      where: { userId: { in: idsFavoritos }, empresaId: s.sub, autor: "EMPRESA" },
      select: {
        userId: true,
        notaPontualidade: true,
        notaComunicacao: true,
        notaTrabalhoEquipe: true,
        notaQualidade: true,
        notaComprometimento: true,
      },
    }),
  ]);

  const vigentes = bloqueios.filter((b) => b.removidoEm === null);
  const historico = bloqueios.filter((b) => b.removidoEm !== null);

  return (
    <div className="space-y-8">
      <Flash searchParams={sp} caminho="/empresa/relacionamento" />
      <AvisoNegado negado={sp.negado} papel={papelDaSessao(s)} />

      <div>
        <h1 className="text-2xl font-bold">Relacionamento</h1>
        <p className="text-sm text-muted">
          Trabalhadores favoritos e bloqueados desta empresa. Favoritar e bloquear também estão disponíveis na tela de
          pagamentos de cada evento.
        </p>
      </div>

      {/* ------------------------------- Favoritos ------------------------------- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Star className="h-5 w-5 text-amber-500" /> Favoritos ({favoritos.length})
        </h2>

        {favoritos.length === 0 ? (
          <EmptyState
            icone={<Star className="h-6 w-6" />}
            titulo="Nenhum favorito ainda"
            descricao="Marque como favorito quem você quer chamar de novo — a lista fica aqui e, no futuro, esses nomes serão sugeridos primeiro na escala."
            acao={{ href: "/empresa/eventos", rotulo: "Ver eventos" }}
          />
        ) : (
          favoritos.map((f) => {
            const rep = reputacoes.get(f.user.id) ?? { media: null, qtd: 0 };
            const resumo = resumirCriterios(avaliacoes.filter((a) => a.userId === f.user.id).map(paraNotas));
            const { melhor, pior } = destaques(resumo);

            return (
              <Card key={f.id} data-testid="favorito" className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.user.fotoPath ?? "/avatar-placeholder.svg"}
                    alt={`Foto de ${f.user.nome}`}
                    className="h-12 w-12 rounded-full border border-surface object-cover"
                  />
                  <div>
                    <p className="font-medium">{f.user.nome}</p>
                    <p className="text-xs text-muted">
                      {f.user.cidade ?? "cidade não informada"}
                      {f.user.habilidades ? ` · ${f.user.habilidades}` : ""}
                    </p>
                    <div className="mt-1"><Estrelas media={rep.media} qtd={rep.qtd} /></div>
                    {melhor && pior && (
                      <p className="mt-1 text-xs text-muted">
                        Destaque: <strong>{melhor.rotulo}</strong> ({melhor.media}) · a melhorar:{" "}
                        <strong>{pior.rotulo}</strong> ({pior.media})
                      </p>
                    )}
                    {f.observacao && <p className="mt-1 text-xs text-muted">“{f.observacao}”</p>}
                    <p className="mt-1 text-xs text-muted">
                      Favoritado em {formatarDataHora(f.createdAt)}
                      {f.criadoPor ? ` por ${f.criadoPor.nome}` : ""}
                    </p>
                  </div>
                </div>

                {podeGerenciar && (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={favoritarTrabalhador}>
                      <input type="hidden" name="userId" value={f.user.id} />
                      <SubmitButton size="sm" variant="ghost" pendingLabel="..." aria-label={`Remover ${f.user.nome} dos favoritos`}>
                        Remover dos favoritos
                      </SubmitButton>
                    </form>
                    <BloquearForm userId={f.user.id} nome={f.user.nome} />
                  </div>
                )}
              </Card>
            );
          })
        )}
      </section>

      {/* ------------------------------- Bloqueios ------------------------------- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Ban className="h-5 w-5 text-red-600" /> Bloqueados ({vigentes.length})
        </h2>

        {vigentes.length === 0 ? (
          <EmptyState
            icone={<Users className="h-6 w-6" />}
            titulo="Nenhum trabalhador bloqueado"
            descricao="Um trabalhador bloqueado deixa de ver as vagas desta empresa e não pode se candidatar. O motivo fica registrado."
          />
        ) : (
          vigentes.map((b) => (
            <Card key={b.id} data-testid="bloqueio" className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{b.user.nome} <Badge tone="danger">Bloqueado</Badge></p>
                  <p className="mt-1 text-sm">Motivo: {b.motivo}</p>
                  <p className="mt-1 text-xs text-muted">
                    Desde {formatarDataHora(b.createdAt)}
                    {b.aplicadoPor ? ` · por ${b.aplicadoPor.nome}` : ""}
                  </p>
                </div>

                {podeDesbloquear ? (
                  <form action={desbloquearTrabalhador} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="bloqueioId" value={b.id} />
                    <Input
                      name="motivoRemocao"
                      placeholder="Motivo da remoção (opcional)"
                      className="w-64"
                      aria-label={`Motivo para desbloquear ${b.user.nome}`}
                    />
                    <SubmitButton size="sm" pendingLabel="..." aria-label={`Desbloquear ${b.user.nome}`}>
                      Desbloquear
                    </SubmitButton>
                  </form>
                ) : (
                  <p className="text-xs text-muted">Somente Administrador ou Proprietário remove bloqueio.</p>
                )}
              </div>
            </Card>
          ))
        )}

        {historico.length > 0 && (
          <details className="rounded-lg border border-surface p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Bloqueios já removidos ({historico.length})
            </summary>
            <ul className="mt-2 space-y-2 text-sm">
              {historico.map((b) => (
                <li key={b.id} className="border-b border-surface pb-2 last:border-0">
                  <strong>{b.user.nome}</strong> — {b.motivo}
                  <p className="text-xs text-muted">
                    Bloqueado em {formatarDataHora(b.createdAt)} · removido em {formatarDataHora(b.removidoEm!)}
                    {b.removidoPor ? ` por ${b.removidoPor.nome}` : ""}
                    {b.motivoRemocao ? ` · ${b.motivoRemocao}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <Card className="text-xs text-muted">
        Favoritar, bloquear e desbloquear ficam registrados na trilha de auditoria com o membro responsável.{" "}
        <Link href="/empresa/eventos" className="text-brand-600 hover:underline">Ir para eventos</Link>
      </Card>
    </div>
  );
}

/** Converte as colunas do banco para as chaves do domínio de avaliação. */
function paraNotas(a: {
  notaPontualidade: number | null;
  notaComunicacao: number | null;
  notaTrabalhoEquipe: number | null;
  notaQualidade: number | null;
  notaComprometimento: number | null;
}) {
  return {
    pontualidade: a.notaPontualidade,
    comunicacao: a.notaComunicacao,
    trabalhoEquipe: a.notaTrabalhoEquipe,
    qualidade: a.notaQualidade,
    comprometimento: a.notaComprometimento,
  };
}
