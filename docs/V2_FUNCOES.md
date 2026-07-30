# v2 — Funções que elevam a produtividade

Enriquecimentos além do escopo básico do TCC. Cada um endereça um "trabalho
futuro" citado na conclusão da monografia.

## 1. Painéis com KPIs
- Empresa (`/empresa/dashboard`): total de eventos por status, vínculos ativos,
  **taxa de preenchimento de vagas**, reputação média, próximos eventos.
- Trabalhador (`/trabalhador/dashboard`): ganhos (escalado/realizado),
  escalações, reputação, vínculos, **taxa de presença**, próximos trabalhos.
- Gráficos inline (`components/ui/stat.tsx`: `StatTile`, `Bar`, `Estrelas`) —
  sem biblioteca externa, acessíveis (role=progressbar), tema claro/escuro.

## 2. Avaliação bidirecional + reputação
- Modelo `Avaliacao` (`autor` EMPRESA|TRABALHADOR, `nota` 1–5, `comentario`),
  única por (evento, empresa, trabalhador, autor).
- Empresa avalia escalados na tela de escalar (evento finalizado); trabalhador
  avalia a empresa pelo histórico.
- Reputação (média + qtd) via `lib/reputacao.ts`, exibida em perfil, painéis e
  na escalação. Actions: `server/actions/avaliacoes.ts`.

## 3. Controle de presença / check-in
- A empresa marca **Presente/Falta** por escalado (reutiliza `StatusInscricao`
  PRESENTE/FALTA). Alimenta reputação e priorização. Action:
  `server/actions/presenca.ts`.

## 4. Escalação inteligente
- Candidatos ordenados por `scorePrioridade` (`lib/stats.ts`): reputação (peso
  maior) + taxa de presença; sem histórico → score 0 (vai ao fim).
- Badges de reputação, presença e habilidades; botão **⚡ Selecionar sugeridos**.
- **Conflito de agenda**: `conflitosDeAgenda` marca quem já está escalado em
  outro evento na mesma data (`lib/reputacao.ts`).

## 5. Perfil enriquecido
- `User.cidade`, `User.bio`, `User.habilidades` — melhoram matching e
  aparecem como chips na escalação.

## 6. Notificações
- Badge de não lidas no menu (contagem no `layout` do trabalhador).

## Modelagem / migração
- `prisma/schema.prisma`: campos no `User`, modelo `Avaliacao`, enum
  `AutorAvaliacao`. Migration `20260725..._v2_reputacao_presenca_perfil`.

## Verificação (executada)
- `tsc --noEmit` sem erros · `npm run build` (20 rotas) · `npm test` **28/28**
  (inclui `stats.test.ts`) · `npm run test:e2e` **62/62** (inclui `v2.spec.ts`:
  painéis, presença, avaliação empresa↔trabalhador persistida no banco).
