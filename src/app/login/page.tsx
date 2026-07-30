import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Escala" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; next?: string; erro?: string }>;
}) {
  const { tipo, next, erro } = await searchParams;
  const tipoInicial = tipo === "EMPRESA" ? "EMPRESA" : "TRABALHADOR";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-center text-xl font-bold text-brand-600">Escala</Link>
      {erro === "acesso_revogado" && (
        <p
          data-testid="acesso-revogado"
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200"
        >
          Seu acesso a esta conta foi revogado ou desativado. Fale com o administrador da empresa.
        </p>
      )}
      <LoginForm tipoInicial={tipoInicial} next={next ?? ""} />
      <p className="mt-6 text-center text-sm text-muted">
        Não tem conta?{" "}
        <Link href="/cadastro/trabalhador" className="text-brand-600 hover:underline">Trabalhador</Link>
        {" · "}
        <Link href="/cadastro/empresa" className="text-brand-600 hover:underline">Empresa</Link>
      </p>
    </main>
  );
}
