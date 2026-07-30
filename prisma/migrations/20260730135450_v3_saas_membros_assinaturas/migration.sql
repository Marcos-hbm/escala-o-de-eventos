-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('TRIAL', 'ATIVA', 'INADIMPLENTE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('PROPRIETARIO', 'ADMIN', 'COORDENADOR', 'VISUALIZADOR');

-- CreateTable
CREATE TABLE "membros" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'COORDENADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "plano" "Plano" NOT NULL DEFAULT 'STARTER',
    "status" "StatusAssinatura" NOT NULL DEFAULT 'TRIAL',
    "trial_termina_em" TIMESTAMP(3),
    "provedor" VARCHAR(40),
    "provedor_ref" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membros_email_key" ON "membros"("email");

-- CreateIndex
CREATE INDEX "membros_empresa_id_idx" ON "membros"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_empresa_id_key" ON "assinaturas"("empresa_id");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill (escrito à mão): o login de empresa passa a resolver por `membros`,
-- então toda empresa já existente precisa de um membro PROPRIETARIO com as
-- MESMAS credenciais de antes (mesmo e-mail e mesmo hash) — assim nenhuma conta
-- perde acesso na migração. Contas anonimizadas (LGPD) entram como inativas,
-- preservando o efeito do direito ao esquecimento.
-- ---------------------------------------------------------------------------
INSERT INTO "membros" ("empresa_id", "nome", "email", "senha_hash", "papel", "ativo", "created_at", "updated_at")
SELECT e."id",
       LEFT(e."nome", 120),
       e."email",
       e."senha_hash",
       'PROPRIETARIO'::"Papel",
       (e."ativo" AND e."anonimizado_em" IS NULL),
       e."created_at",
       CURRENT_TIMESTAMP
FROM "empresas" e;

-- Toda empresa nasce com assinatura; no backfill entram no STARTER/TRIAL.
INSERT INTO "assinaturas" ("empresa_id", "plano", "status", "created_at", "updated_at")
SELECT e."id", 'STARTER'::"Plano", 'TRIAL'::"StatusAssinatura", e."created_at", CURRENT_TIMESTAMP
FROM "empresas" e;
