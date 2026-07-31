import { requireTrabalhador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reputacoesDeTrabalhadores } from "@/lib/reputacao";
import { LgpdPanel } from "@/components/lgpd-panel";
import { Card } from "@/components/ui/card";
import { Estrelas } from "@/components/ui/stat";
import { PerfilTrabalhadorForm } from "./form";
import { ChavePixForm } from "./pix-form";
import { chavePixMascarada } from "@/lib/pix-leitura";
import { notFound } from "next/navigation";
import { Flash } from "@/components/ui/flash";

export const metadata = { title: "Perfil — Escala" };

export default async function PerfilTrabalhador({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; erro_op?: string }>;
}) {
  const sp = await searchParams;
  const s = await requireTrabalhador();
  const user = await prisma.user.findUnique({
    where: { id: s.sub },
    select: {
      nome: true, email: true, cpf: true, telefone: true, genero: true, fotoPath: true,
      cidade: true, bio: true, habilidades: true,
    },
  });
  if (!user) notFound();

  const rep = (await reputacoesDeTrabalhadores([s.sub])).get(s.sub) ?? { media: null, qtd: 0 };
  // A chave vem já mascarada do servidor: a tela nunca recebe o valor completo.
  const pix = await chavePixMascarada(s.sub);

  return (
    <div className="space-y-6">
      <Flash searchParams={sp} caminho="/trabalhador/perfil" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meu perfil</h1>
        <Card className="px-4 py-2">
          <span className="text-xs text-muted">Sua reputação: </span>
          <Estrelas media={rep.media} qtd={rep.qtd} />
        </Card>
      </div>
      <ChavePixForm tipoAtual={pix?.tipo ?? null} mascaraAtual={pix?.mascara ?? null} />
      <PerfilTrabalhadorForm user={user} />
      <LgpdPanel />
    </div>
  );
}
