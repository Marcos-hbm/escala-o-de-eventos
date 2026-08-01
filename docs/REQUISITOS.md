# Mapa de requisitos → implementação

Rastreabilidade entre os requisitos do TCC e o código.

## Requisitos Funcionais

| ID | Requisito | Onde |
| --- | --- | --- |
| RF01 | Cadastro de trabalhador | `server/actions/auth.ts` → `cadastrarTrabalhador`; UI `app/cadastro/trabalhador`; validação `lib/validations.ts` |
| RF02 | Cadastro de empresa | `auth.ts` → `cadastrarEmpresa`; UI `app/cadastro/empresa` |
| RF03 | Autenticação (e-mail + senha, por tipo) | `auth.ts` → `entrar`; `lib/auth.ts` → `verificarCredenciais`; `lib/session.ts`; UI `app/login` |
| RF04 | Gerenciamento de perfil (com foto) | `server/actions/perfil.ts` → `editarPerfil*`; `lib/upload.ts`; UI `*/perfil` |
| RF05 | CRUD de eventos | `server/actions/eventos.ts` (criar/editar/excluir); UI `app/empresa/eventos*` |
| RF06 | Envio e aceite de convites de vínculo | `server/actions/vinculos.ts` → `convidarTrabalhador`, `solicitarVinculo`, `responderVinculo` |
| RF07 | Listagem de vínculos (ativos e pendentes) | UI `app/*/vinculos` |
| RF08 | Lançar proposta de evento (notifica vinculados) | `eventos.ts` → `criarEvento` (status `PUBLICADO` + `notificarEmLote`) |
| RF09 | Aceitar/recusar proposta | `server/actions/inscricoes.ts` → `inscreverEvento`, `recusarEvento`; UI `app/trabalhador/eventos/[id]` |
| RF10 | Escalar trabalhadores | `server/actions/escala.ts` → `escalarEFinalizar`; UI `.../escalar` |
| RF11 | Gerar lista de escalados (CSV) | `app/empresa/eventos/[id]/lista/route.ts`; `lib/csv.ts` |
| RF12 | Histórico de participações | UI `app/trabalhador/historico` |
| RF13 | Só vinculados participam | `inscricoes.ts` → `vinculoAtivo` (bloqueio); `app/trabalhador/eventos` filtra por vínculo ATIVO |
| RF14 | Status de inscrição automático | enum `StatusInscricao`; atualizado em `inscricoes.ts` e `escala.ts` |
| RF15 | Notificações internas | `lib/notifications.ts`; disparado em vínculos/eventos/escala; UI `app/trabalhador/notificacoes` |

## Requisitos Não Funcionais

| ID | Requisito | Como é atendido |
| --- | --- | --- |
| RNF01 | Usabilidade | UI responsiva, estados de carregamento (`useFormStatus`, skeletons), empty states com próximo passo, tema claro/escuro, confirmação em ação destrutiva |
| RNF02 | Disponibilidade | Arquitetura stateless (JWT em cookie) → escala horizontal; healthcheck do Postgres no compose |
| RNF03 | Segurança de dados | Senha em hash bcrypt; sessão em cookie httpOnly/SameSite; cabeçalhos de segurança (`next.config.ts`); RBAC por papel validado no servidor; **chave PIX cifrada em repouso** (AES-256-GCM) com leitura auditada; dados visíveis só ao titular e a empresas vinculadas |
| RNF04 | Compatibilidade | HTML/CSS/JS padrão; funciona em Chrome, Firefox e Edge |
| RNF05 | Integridade dos dados | Transações Prisma (`$transaction`), chaves estrangeiras, `@@unique` e **CHECK constraints/índices parciais** escritos à mão (destinatário exclusivo da notificação, pago ≤ devido, notas 1..5, um bloqueio vigente, uma contestação em aberto) |
| RNF06 | Portabilidade | Docker + variáveis de ambiente; Prisma abstrai o SGBD |
| RNF07 | Auditoria | `lib/audit.ts` + tabela `audit_logs`: login (com membro e papel), cadastro, CRUD de eventos, vínculos, escala, ações LGPD, **toda alteração financeira**, visualização de chave PIX, bloqueio/desbloqueio, solicitações e check-in/check-out |

## Itens da especificação v4 → implementação

A v4 é um pedido de produto (não do TCC): transformar o sistema num SaaS comercial.
Rastreabilidade item por item, com o que ficou **fora** declarado.

| Item | Pedido | Onde | Situação |
| --- | --- | --- | --- |
| 1 | Data e hora no padrão brasileiro | `lib/datetime.ts` (único ponto de formatação), `lib/csv.ts` | ✅ telas, tabelas, cards, painéis, notificações e CSV. **PDF e e-mail não existem no sistema** — declarado, não implementado |
| 2 | Fluxo pós-evento / "Finalizar Pagamentos" | `app/empresa/eventos/[id]/pagamentos`, `server/actions/pagamentos.ts` | ✅ inclui foto, função, horário, valor, situação, forma, PIX copiável, observações, favoritar, bloquear e avaliar |
| 3 | Avaliação em cinco critérios | `lib/domain/avaliacao.ts`, `.../escalar/avaliar-trabalhador.tsx` | ✅ nota geral = média; alimenta o histórico do trabalhador. Recomendação por IA: fora de escopo |
| 4 | Favoritos | `server/actions/relacionamento.ts`, `app/empresa/relacionamento` | ✅ lista própria. "Sugerir primeiro nas escalas" era futuro: **não implementado** |
| 5 | Bloqueio | `lib/bloqueio.ts` + filtros em descoberta, detalhe, inscrição e busca | ✅ com motivo, efeito real nas consultas e remoção restrita a P/A |
| 6 | Pagamento do trabalhador | `app/trabalhador/financeiro`, `INDICADOR_STATUS` | ✅ notificação, indicador ✅/⏳ no card, histórico e contestação. Anexo de comprovante era futuro: **não implementado** |
| 7 | Comunicação durante o evento | `lib/domain/comunicacao.ts`, `.../[id]/comunicacao.tsx` | ✅ seis tipos, cinco status, janela no dia do evento, histórico preservado. "Tempo real" = polling de 15 s ([ADR 0007](adr/0007-comunicacao-do-evento-janela-e-tempo-real.md)) |
| 8 | Painel dos coordenadores | `app/empresa/eventos/[id]/painel` | ✅ equipe, solicitações, respostas (aprovar/recusar/aguardar/finalizar), mensagens, presença, check-in e check-out |
| 9 | Fechamento de caixa | `pagamentos.ts` → `iniciarFechamentoCaixa`, `registrarItemFechamento`, `concluirFechamentoCaixa` | ✅ notifica todos, valor + forma por trabalhador, pago/parcial/não pago, pendência fica para a empresa |
| 10 | Histórico financeiro | `app/empresa/financeiro`, `app/trabalhador/financeiro`, `pagamento_lancamentos` | ✅ evento, empresa, valor, data, forma, situação e observações |
| 11 | Banco de dados | `prisma/schema.prisma` (21 tabelas), [`DIAGRAMA_BANCO.md`](DIAGRAMA_BANCO.md) | ✅ entidades, relacionamentos, índices e CHECK constraints |
| 12 | UX/UI | `components/ui/*` | ✅ empty states, skeleton, feedback, confirmação em ação destrutiva, ícones, responsividade, dark mode, busca, filtros, paginação. Toast ficou restrito a confirmação de cliente ([ADR 0004](adr/0004-atualizacao-de-tela-apos-server-action.md)) |
| 13 | Segurança | `lib/rbac.ts`, `lib/cripto.ts`, `lib/pix-leitura.ts`, `lib/audit.ts` | ✅ acesso financeiro restrito, PIX cifrado e auditado, permissões validadas no servidor |
| 14 | Testes | `tests/unit`, `tests/integration`, `tests/e2e` | ✅ unitário, integração (PostgreSQL real) e E2E (Playwright) |
| 15 | Documentação | este arquivo, [`ARQUITETURA`](ARQUITETURA.md), [`DIAGRAMA_BANCO`](DIAGRAMA_BANCO.md), [`CASOS_DE_USO`](CASOS_DE_USO.md), [`API_ACTIONS`](API_ACTIONS.md), [`adr/`](adr/) | ✅ |

## Casos de uso

O detalhamento por caso de uso (UC-01…UC-41, incluindo atores, fluxo e regras) está em
[`CASOS_DE_USO.md`](CASOS_DE_USO.md) — cobre as Tabelas 06–11 do TCC e os fluxos
acrescentados nas versões v2, v3 e v4.
