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

Restrições relevantes:

- `vinculos`: `@@unique(userId, empresaId)` — um vínculo por par.
- `inscricoes`: `@@unique(eventoId, userId)` — uma inscrição por evento.
- `membros`: `email` único (é a credencial de login da conta);
  `assinaturas`: `empresa_id` único (1–1 com a empresa).
- FKs com `onDelete: Cascade` (ou `SetNull` em consentimento) garantem
  integridade referencial (RNF05).

### Ciclo de vida

- **Vínculo:** `PENDENTE → ATIVO | RECUSADO`; `ATIVO → DESVINCULADO`.
- **Evento:** `PUBLICADO → FINALIZADO` (reabrível); `→ CANCELADO`.
- **Inscrição:** `INSCRITO → ESCALADO | RECUSADO_EMPRESA | CANCELADO_TRABALHADOR`.

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
