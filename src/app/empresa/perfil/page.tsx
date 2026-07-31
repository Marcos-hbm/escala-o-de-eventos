import { papelDaSessao, requireEmpresa, sessaoPode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { formatCNPJ } from "@/lib/utils";
import { LgpdPanel } from "@/components/lgpd-panel";
import { AvisoNegado } from "@/components/aviso-negado";
import { Flash } from "@/components/ui/flash";
import { PerfilEmpresaForm } from "./form";

export const metadata = { title: "Perfil — Escala" };

export default async function PerfilEmpresa({
  searchParams,
}: {
  searchParams: Promise<{ negado?: string; aviso?: string; erro_op?: string }>;
}) {
  const s = await requireEmpresa();
  const sp = await searchParams;
  const { negado } = sp;
  const empresa = await prisma.empresa.findUnique({
    where: { id: s.sub },
    select: { nome: true, email: true, cnpj: true, telefone: true, fotoPath: true },
  });
  if (!empresa) notFound();

  return (
    <div className="space-y-6">
      <Flash searchParams={sp} caminho="/empresa/perfil" />
      <AvisoNegado negado={negado} papel={papelDaSessao(s)} />
      <h1 className="text-2xl font-bold">Perfil da empresa</h1>
      {sessaoPode(s, "empresa:editar") ? (
        <PerfilEmpresaForm empresa={empresa} />
      ) : (
        <Card className="space-y-1 text-sm">
          <p className="font-medium">{empresa.nome}</p>
          <p className="text-muted">{empresa.email} · {formatCNPJ(empresa.cnpj)} · {empresa.telefone}</p>
          <p className="pt-2 text-muted">Seu papel permite apenas visualizar os dados da empresa.</p>
        </Card>
      )}
      <LgpdPanel podeExcluir={sessaoPode(s, "conta:excluir")} />
    </div>
  );
}
