import Link from "next/link";
import { CadastroTrabalhadorForm } from "./form";

export const metadata = { title: "Cadastro de Trabalhador — Escala" };

export default function Page() {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <Link href="/login" className="text-sm text-brand-600 hover:underline">← Voltar</Link>
      <h1 className="mt-3 text-2xl font-bold">Criar conta de trabalhador</h1>
      <p className="mb-6 text-sm text-muted">Pessoa física. Preencha seus dados para começar.</p>
      <CadastroTrabalhadorForm />
    </main>
  );
}
