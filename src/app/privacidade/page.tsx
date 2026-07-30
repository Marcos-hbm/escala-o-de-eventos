import Link from "next/link";

export const metadata = { title: "Política de Privacidade — Escala" };

export default function Privacidade() {
  const dpo = process.env.NEXT_PUBLIC_DPO_EMAIL ?? "privacidade@exemplo.com.br";
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-brand-600 hover:underline">← Voltar</Link>
      <h1 className="mt-4 text-3xl font-bold">Política de Privacidade e Tratamento de Dados</h1>
      <p className="mt-2 text-sm text-muted">Versão 1.0 — em conformidade com a Lei nº 13.709/2018 (LGPD).</p>

      <div className="prose mt-8 space-y-6 text-sm leading-relaxed">
        <Secao titulo="1. Controlador e Encarregado (DPO)">
          O Sistema de Escalação de Freelancers é o controlador dos dados tratados na plataforma.
          Dúvidas e solicitações relativas aos seus dados podem ser enviadas ao Encarregado de
          Proteção de Dados pelo e-mail <strong>{dpo}</strong>.
        </Secao>

        <Secao titulo="2. Dados coletados">
          <ul className="list-disc pl-6">
            <li><strong>Trabalhador:</strong> nome, e-mail, CPF, data de nascimento, telefone, gênero (opcional) e foto de perfil (opcional).</li>
            <li><strong>Empresa:</strong> razão social/nome, CNPJ, e-mail, telefone e logo (opcional).</li>
            <li><strong>Uso:</strong> vínculos, inscrições em eventos, histórico de participação e registros de auditoria (data/hora, ação e IP).</li>
          </ul>
        </Secao>

        <Secao titulo="3. Finalidade e base legal">
          Os dados são tratados para viabilizar o cadastro, a autenticação, a formação de vínculos e
          a escalação em eventos (execução de contrato e legítimo interesse, art. 7º, V e IX), bem
          como mediante o seu <strong>consentimento</strong> registrado no ato do cadastro (art. 7º, I).
        </Secao>

        <Secao titulo="4. Compartilhamento">
          Os dados de um trabalhador só ficam visíveis às empresas com as quais ele possui vínculo
          ativo, e apenas na medida necessária à escalação. Não vendemos dados a terceiros.
        </Secao>

        <Secao titulo="5. Segurança">
          Senhas são armazenadas apenas como hash (bcrypt). O acesso à sessão usa token assinado em
          cookie httpOnly. Todas as ações sensíveis são registradas em trilha de auditoria (RNF07).
        </Secao>

        <Secao titulo="6. Seus direitos (art. 18)">
          Você pode, a qualquer momento, dentro da plataforma (menu Perfil):
          <ul className="list-disc pl-6">
            <li><strong>Acessar e portar</strong> seus dados — exportação em JSON.</li>
            <li><strong>Corrigir</strong> dados incompletos ou desatualizados — edição de perfil.</li>
            <li><strong>Eliminar</strong> sua conta — anonimização irreversível dos dados pessoais, preservando apenas registros históricos exigidos por lei, já sem identificação.</li>
          </ul>
        </Secao>

        <Secao titulo="7. Retenção">
          Os dados são mantidos enquanto a conta estiver ativa. Após a exclusão, os dados pessoais são
          anonimizados; registros de eventos já realizados são preservados de forma não identificável.
        </Secao>
      </div>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="mt-2 text-muted">{children}</div>
    </section>
  );
}
