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
| RNF01 | Usabilidade | UI responsiva (Tailwind), estados de carregamento (`useFormStatus`), mensagens de erro por campo |
| RNF02 | Disponibilidade | Arquitetura stateless (JWT em cookie) → escala horizontal; healthcheck do Postgres no compose |
| RNF03 | Segurança de dados | Senha em hash bcrypt; sessão em cookie httpOnly/SameSite; cabeçalhos de segurança (`next.config.ts`); dados visíveis só ao titular e a empresas vinculadas |
| RNF04 | Compatibilidade | HTML/CSS/JS padrão; funciona em Chrome, Firefox e Edge |
| RNF05 | Integridade dos dados | Transações Prisma (`$transaction`), chaves estrangeiras e `@@unique` (vínculo e inscrição únicos) |
| RNF06 | Portabilidade | Docker + variáveis de ambiente; Prisma abstrai o SGBD |
| RNF07 | Auditoria | `lib/audit.ts` + tabela `audit_logs`: login, cadastro, CRUD de eventos, vínculos, escala, ações LGPD |

## Casos de uso (Tabelas 06–11 do TCC)

Criar conta, conectar ao sistema, enviar/aceitar convite de vínculos, lançar
proposta, aceitar, escalar e gerar lista — todos cobertos pelas server actions
e telas listadas acima.
