# Conformidade com a LGPD (Lei nº 13.709/2018)

Como a plataforma trata dados pessoais e atende aos direitos do titular.

## Dados tratados

| Titular | Dados |
| --- | --- |
| Trabalhador | nome, e-mail, CPF, data de nascimento, telefone, gênero (opcional), foto (opcional) |
| Empresa | razão social/nome, CNPJ, e-mail, telefone, logo (opcional) |
| Uso | vínculos, inscrições, histórico, logs de auditoria (data/hora, ação, IP) |

## Bases legais (Art. 7º)

- **Consentimento (I):** registrado no cadastro (checkbox obrigatório) na tabela
  `consentimentos`, com finalidade, versão do documento e data.
- **Execução de contrato / legítimo interesse (V, IX):** operação da escalação.

## Direitos do titular (Art. 18) — implementados

| Direito | Onde | Como |
| --- | --- | --- |
| Acesso e **portabilidade** (II, V) | `GET /api/lgpd/export` (botão no Perfil) | Exporta todos os dados do titular em JSON (sem o hash de senha) |
| **Correção** (III) | Tela de Perfil | Edição de dados cadastrais |
| **Eliminação** (VI) | Botão "Excluir minha conta" no Perfil | Anonimização irreversível (`lib/lgpd.ts`) |

## Anonimização vs. exclusão física

A exclusão **anonimiza** em vez de apagar fisicamente: nome, e-mail, CPF/CNPJ,
telefone e foto são substituídos por marcadores; a senha é invalidada; a conta é
desativada. Vínculos são desfeitos e inscrições futuras canceladas.

Motivo (Art. 16): registros históricos de eventos já realizados e a trilha de
auditoria precisam ser conservados para cumprimento de obrigações e exercício de
direitos — mas passam a existir **sem dados identificáveis**.

## Segurança (Art. 46)

- Senhas apenas como **hash bcrypt** — nunca em texto puro nem exportadas.
- Sessão em **cookie httpOnly** (imune a leitura por JavaScript), `SameSite=Lax`,
  `Secure` em produção.
- Cabeçalhos de segurança (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`) em `next.config.ts`.
- **Minimização de acesso:** dados de um trabalhador só são visíveis a empresas
  com vínculo ativo, e no mínimo necessário à escalação.
- **Trilha de auditoria** (`audit_logs`) para todas as ações sensíveis (RNF07).

## Encarregado (DPO)

Contato exibido na Política de Privacidade, configurável via
`NEXT_PUBLIC_DPO_EMAIL`.

## Pendências para produção

- Retenção/expurgo automático de logs antigos (cron).
- Cifragem em repouso a nível de coluna para CPF/CNPJ (ex.: `pgcrypto`), se o
  modelo de ameaça exigir.
- Aviso de cookies caso venham a ser usados cookies não essenciais.
