# Arquitetura

## Visão geral

Aplicação **full-stack Next.js (App Router)**. O navegador renderiza Server
Components; mutações passam por **Server Actions** (funções `"use server"`) — não
há uma API REST separada, exceto dois *route handlers* para download (CSV e
export LGPD). O banco é acessado só no servidor, via Prisma.

```
Navegador ──HTTP──> Next.js (Server Components + Server Actions)
                        │
                        ├── lib/session (JWT em cookie httpOnly)  ← RBAC
                        ├── lib/auth (bcrypt, verificação por tipo/membro)
                        ├── lib/datetime + lib/paginacao (formatação e paginação, puros)
                        ├── lib/rbac + lib/planos (regras puras: papéis, limites)
                        ├── lib/assinatura (plano + uso do tenant)
                        ├── server/actions/* (regras de negócio)
                        └── Prisma ──> PostgreSQL
```

## Autenticação e autorização

- Duas naturezas de conta em tabelas distintas: `users` (trabalhador) e
  `empresas`. O tipo faz parte do payload da sessão.
- Login valida credenciais na tabela correta (`verificarCredenciais`) e assina
  um JWT (`jose`, HS256) guardado em cookie **httpOnly / SameSite=Lax**.
- `middleware.ts` protege `/trabalhador/*` e `/empresa/*` no edge e redireciona
  conforme o papel.
- Cada server action revalida a sessão e a **posse do recurso** (ex.: só a
  empresa dona edita o evento) — defesa em profundidade, sem confiar só no
  middleware.
- **v3 (SaaS):** o login de empresa resolve por `membros`; a sessão aponta para a
  empresa (tenant) e carrega `membroId`/`papel`. `requireEmpresa()` revalida o
  membro no banco a cada acesso (revogação e troca de papel valem no próximo
  request). O papel controla **escrita** dentro da conta (`lib/rbac.ts`), em três
  camadas: server action, página (`requirePermissao`) e UI. Detalhes em
  [`V3_SAAS.md`](V3_SAAS.md) e nos ADRs
  [0001](adr/0001-membro-como-identidade-de-login-da-empresa.md) /
  [0002](adr/0002-o-que-o-plano-limita.md).

## Modelo de dados

Cinco entidades do dicionário do TCC — `users`, `empresas`, `eventos`,
`vinculos`, `inscricoes` — mais três extensões justificadas:

- `notificacoes` (RF15)
- `audit_logs` (RNF07)
- `consentimentos` (LGPD)
- `avaliacoes` (v2 — reputação bidirecional)
- `membros` e `assinaturas` (v3 — equipe da conta e plano/assinatura)
- **v4 — financeiro:** `pagamentos` (saldo por evento×trabalhador),
  `pagamento_lancamentos` (cada movimento: total, parcial, ajuste),
  `contestacoes_pagamento`, `fechamentos_caixa` e `fechamento_caixa_itens`
- **v4 — relacionamento:** `trabalhador_favoritos`, `trabalhador_bloqueios`
- **v4 — comunicação e presença:** `solicitacoes_evento`, `mensagens_coordenador`,
  `registros_presenca` (check-in/check-out com horário real)

Restrições relevantes:

- `vinculos`: `@@unique(userId, empresaId)` — um vínculo por par.
- `inscricoes`: `@@unique(eventoId, userId)` — uma inscrição por evento.
- `membros`: `email` único (é a credencial de login da conta);
  `assinaturas`: `empresa_id` único (1–1 com a empresa).
- **v4** — invariantes escritas à mão na migration, porque o Prisma não as modela:
  `notificacoes` exige exatamente um destinatário (trabalhador XOR membro);
  `pagamentos` não aceita valor negativo nem pago acima do devido;
  `pagamento_lancamentos` exige valor positivo; notas de avaliação ficam em 1..5;
  índices parciais garantem **um** bloqueio vigente por par empresa×trabalhador e
  **uma** contestação em aberto por pagamento. Detalhes e motivos no
  [ADR 0005](adr/0005-chave-pix-cifrada-e-rbac-financeiro.md).
- FKs com `onDelete: Cascade` (ou `SetNull` em consentimento) garantem
  integridade referencial (RNF05).

### Ciclo de vida

- **Vínculo:** `PENDENTE → ATIVO | RECUSADO`; `ATIVO → DESVINCULADO`.
- **Evento:** `PUBLICADO → FINALIZADO` (reabrível); `→ CANCELADO`.
- **Inscrição:** `INSCRITO → ESCALADO | RECUSADO_EMPRESA | CANCELADO_TRABALHADOR`.

## Financeiro e dados sensíveis (v4)

```
Empresa (tenant)
  └── Evento
        ├── Inscricao ──── RegistroPresenca      (check-in / check-out)
        ├── Pagamento ─┬── PagamentoLancamento   (histórico: total, parcial, ajuste)
        │              └── ContestacaoPagamento  (aberta pelo trabalhador)
        ├── FechamentoCaixa ── FechamentoCaixaItem (um por trabalhador conferido)
        ├── SolicitacaoEvento                    (intervalo, ajuda, substituição…)
        └── MensagemCoordenador                  (equipe ou individual)
```

- **Dinheiro** em `Decimal(10,2)`; as regras de cálculo ficam em
  `lib/domain/pagamento.ts` (funções puras: saldo, status derivado, lançamento
  parcial, resumo) e o I/O nas server actions. Float em dinheiro é erro de
  arredondamento garantido.
- **Chave PIX** cifrada com AES-256-GCM (`lib/cripto.ts`), lida por um único caminho
  auditado (`lib/pix-leitura.ts`) que exige permissão financeira **e** o trabalhador
  escalado num evento da empresa. Ver
  [ADR 0005](adr/0005-chave-pix-cifrada-e-rbac-financeiro.md).
- **RBAC financeiro**: `financeiro:gerenciar`, `financeiro:ver` e `pix:ver`.
  Proprietário e Administrador pelo papel; Coordenador só com
  `Membro.autorizadoFinanceiro`; Visualizador nunca.
- **Notificações** passam a ter destinatário polimórfico (trabalhador **ou** membro),
  sem o que "o coordenador recebe em tempo real" não teria onde chegar.
- **Formulários financeiros são renderizados no servidor** e o resultado (sucesso ou
  recusa, inclusive erro de validação) volta como aviso na URL. Isso não é
  preferência de estilo: com `useActionState` em client component a tela ficava no
  estado anterior em parte dos cliques — inaceitável em dinheiro (ADR 0004).

## Apresentação (v4 fase 1)

- **Data e hora**: tudo passa por `lib/datetime.ts`, que separa data civil
  (`@db.Date`, formatada em UTC) de instante (timestamp, formatado em
  `America/Sao_Paulo`). Ver [ADR 0003](adr/0003-data-e-hora-no-padrao-brasileiro.md).
- **Paginação**: `lib/paginacao.ts` (puro) + `components/ui/paginacao.tsx` (links
  reais, com `aria-current`). As listagens consultam com `skip`/`take` e contam no
  banco — nenhuma tela carrega a tabela inteira.
- **Tema**: preferência em cookie (`escala_tema`) lida no layout raiz, então o
  primeiro paint já sai no tema escolhido; o variant `dark:` do Tailwind foi
  redefinido para valer tanto para `prefers-color-scheme` quanto para a escolha
  explícita.
- **Feedback**: `components/ui/toast.tsx` (região `aria-live`, auto-dismiss
  pausável) para resultado de operação; erros de campo permanecem inline. Estados
  vazios em `components/ui/empty-state.tsx` e skeletons em
  `components/ui/skeleton.tsx` (via `loading.tsx` das rotas que não podem 404).
- **Atualização após mutação**: ações sem `ActionState` redirecionam de volta à
  origem em vez de confiar apenas em `revalidatePath` — motivo, medições e
  limitação remanescente em
  [ADR 0004](adr/0004-atualizacao-de-tela-apos-server-action.md).

## Relacionamento e avaliação (v4)

- **Bloqueio é regra de consulta**, não só registro: `lib/bloqueio.ts` concentra as
  três perguntas do sistema (quais empresas bloquearam este trabalhador; este
  trabalhador está bloqueado nesta empresa; quem esta empresa bloqueou) e é usado na
  descoberta de vagas, no detalhe do evento, na action de inscrição e na busca de
  candidatos. Bloquear também desfaz o vínculo e cancela inscrições futuras, para não
  existir estado contraditório.
- **Avaliação por critérios** em `lib/domain/avaliacao.ts` (puro): a nota geral é a
  média arredondada dos cinco critérios, o que mantém `lib/reputacao.ts` e o score da
  escalação funcionando — inclusive para avaliações gravadas antes da v4, que só têm
  a nota geral.
- **Remover bloqueio exige `equipe:gerenciar`** (Administrador/Proprietário), embora
  bloquear seja permitido ao Coordenador: quem bloqueia não deveria desfazer sozinho
  o registro que justificou a decisão.

## Regras de negócio centrais

- **RF13** — inscrição exige vínculo `ATIVO` com a empresa organizadora
  (bloqueio em `inscricoes.ts` e filtro na tela de descoberta).
- **Escalação atômica** — `escalarEFinalizar` roda em transação: marca
  escalados, recusa os demais inscritos e finaliza o evento de uma vez.
- **Notificações** — criadas em lote ao publicar evento e ao escalar; nunca
  derrubam a operação principal (falha é logada, não propagada).

## Decisões de projeto

| Decisão | Motivo |
| --- | --- |
| PostgreSQL no lugar de MySQL | Enums nativos, melhor integridade, `ILIKE`/`mode:"insensitive"` |
| Server Actions no lugar de REST | Menos boilerplate, tipos compartilhados, progressive enhancement |
| Anonimização no lugar de DELETE físico (LGPD) | Preserva histórico de eventos e trilha de auditoria sem manter PII |
| `jose` no lugar de `next-auth` | Duas tabelas de conta; controle total do token |
| Login de empresa por `membros`, tenant continua `empresas` (ADR 0001) | Multiusuário + RBAC sem reescrever as consultas escopadas por `empresa_id` |
| Plano limita uso e um extra da v2, nunca RF do TCC (ADR 0002) | Cobertura de requisitos permanece íntegra no plano gratuito |
