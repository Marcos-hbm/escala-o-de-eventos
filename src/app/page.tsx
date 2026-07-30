import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarCheck, Users, ListChecks, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold text-brand-600">Escala</span>
        <nav className="flex gap-2">
          <Link href="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
          <Link href="/cadastro/trabalhador"><Button size="sm">Criar conta</Button></Link>
        </nav>
      </header>

      <section className="mt-16 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Escalação de freelancers para eventos, sem planilha e sem grupo de WhatsApp
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
          Empresas publicam oportunidades, trabalhadores se candidatam e a escala final sai
          rastreável, organizada e pronta para exportar.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/cadastro/empresa"><Button size="md">Sou empresa</Button></Link>
          <Link href="/cadastro/trabalhador"><Button size="md" variant="outline">Sou trabalhador</Button></Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Feature icon={<Users className="h-6 w-6" />} titulo="Vínculos" texto="Empresa e trabalhador se conectam por convite antes de qualquer escala." />
        <Feature icon={<CalendarCheck className="h-6 w-6" />} titulo="Propostas" texto="Publique eventos com data, local, funções e cachê. Vinculados são notificados." />
        <Feature icon={<ListChecks className="h-6 w-6" />} titulo="Escala e lista" texto="Selecione os escalados e exporte a lista final em CSV." />
        <Feature icon={<ShieldCheck className="h-6 w-6" />} titulo="LGPD" texto="Consentimento, portabilidade de dados e direito ao esquecimento embutidos." />
      </section>

      <footer className="mt-20 border-t border-surface pt-6 text-center text-sm text-muted">
        <p>TCC — Centro Universitário do Distrito Federal (UDF), 2025.</p>
        <p className="mt-1">
          <Link href="/privacidade" className="underline hover:text-brand-600">Política de Privacidade (LGPD)</Link>
        </p>
      </footer>
    </main>
  );
}

function Feature({ icon, titulo, texto }: { icon: React.ReactNode; titulo: string; texto: string }) {
  return (
    <Card>
      <div className="mb-3 inline-flex rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-700/20">{icon}</div>
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mt-1 text-sm text-muted">{texto}</p>
    </Card>
  );
}
