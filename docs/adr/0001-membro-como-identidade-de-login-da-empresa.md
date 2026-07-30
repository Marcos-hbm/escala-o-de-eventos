# ADR 0001 — Membro como identidade de login da empresa (tenant continua sendo a Empresa)

- **Status:** aceito
- **Data:** 2026-07-30
- **Contexto da versão:** v3 (modelo SaaS)

## Contexto

Até a v2, a conta de empresa era **um único usuário**: `empresas.email` +
`empresas.senha_hash` eram as credenciais, e a sessão guardava `sub = empresa.id`.
Todas as consultas de negócio já eram escopadas por `empresa_id`
(`eventos`, `vinculos`, `inscricoes`, `avaliacoes`).

A v3 precisa de: (a) várias pessoas acessando a mesma conta com papéis
diferentes (dono, coordenador de operação, alguém só de leitura) e (b) plano de
assinatura com limites por conta.

Alternativas consideradas:

1. **Tabela `membros` com o login movido para lá; `Empresa` segue como tenant.**
2. Unificar tudo numa tabela `users` genérica com `tipo` + tabela de vínculo
   usuário↔empresa (modelo "org/membership" clássico).
3. Manter o login em `empresas` e criar `membros` apenas como usuários
   "secundários", com dois caminhos de autenticação.

## Decisão

Adotada a **alternativa 1**: o login de empresa resolve por `membros`
(`email` único, `senha_hash`, `papel`, `ativo`), e a **Empresa continua sendo o
tenant** — a sessão mantém `sub = empresa.id` e passa a carregar
`membroId`, `papel` e `membroNome`.

Toda empresa tem ao menos um membro `PROPRIETARIO`:

- no cadastro, criado na mesma transação da empresa (com a assinatura);
- na migration, criado por backfill com **o mesmo e-mail e o mesmo hash** que a
  empresa já usava — nenhuma conta existente perde acesso.

## Consequências

**Positivas**

- Nenhuma consulta de negócio mudou: `where: { empresaId: s.sub }` continua
  válido, então multiusuário e RBAC entraram sem reescrever o núcleo do sistema
  (e sem risco de regressão — a suíte E2E anterior passou sem alteração de
  asserts, só de fixtures).
- O isolamento entre contas segue sendo o `empresa_id`, não um `papel` — o RBAC
  restringe **escrita** dentro da conta, não visibilidade entre contas.
- `requireEmpresa()` revalida o membro no banco a cada acesso, então revogar
  acesso ou trocar papel vale no próximo request (e não em até 8h, a validade do
  JWT).
- Ganchos de billing (`assinaturas.provedor/provedor_ref`) ficam prontos para um
  PSP sem tocar em autenticação.

**Negativas / dívidas aceitas**

- **Credenciais duplicadas em `empresas`**: as colunas `email`/`senha_hash` de
  `empresas` continuam existindo (histórico e exportação LGPD), mas não
  autenticam mais. Remover exige uma migration de limpeza — não feita agora para
  não misturar mudança de comportamento com remoção de coluna.
- `membros.email` é único **globalmente**, não por empresa: a mesma pessoa não
  pode ser membro de duas empresas com o mesmo e-mail. Aceitável no escopo do
  TCC (uma equipe pertence a uma produtora); mudar exige `@@unique([empresaId,
  email])` + escolha de conta no login.
- Uma consulta extra por request na área da empresa (revalidação do membro por
  PK, indexada) — trocamos latência marginal por revogação imediata.
- Sessões emitidas antes da v3 não têm `papel`; são tratadas como
  `PROPRIETARIO` até expirar, porque eram, de fato, o usuário único da conta.

## Alternativas rejeitadas

- **Tabela `users` unificada (alt. 2):** modelo mais "de mercado", mas obrigaria
  a reescrever autenticação, sessão, middleware e todas as consultas de
  trabalhador — e o dicionário de dados do TCC descreve `users` como a tabela do
  **trabalhador**. Custo alto e afastamento do documento base sem ganho no
  escopo atual.
- **Dois caminhos de login (alt. 3):** duas formas de autenticar a mesma conta =
  duas superfícies de ataque e regras duplicadas de revogação. Rejeitada por
  segurança e manutenção.
