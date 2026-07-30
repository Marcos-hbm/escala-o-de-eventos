-- CreateEnum
CREATE TYPE "AutorAvaliacao" AS ENUM ('EMPRESA', 'TRABALHADOR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" VARCHAR(500),
ADD COLUMN     "cidade" VARCHAR(120),
ADD COLUMN     "habilidades" VARCHAR(400);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "autor" "AutorAvaliacao" NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avaliacoes_user_id_idx" ON "avaliacoes"("user_id");

-- CreateIndex
CREATE INDEX "avaliacoes_empresa_id_idx" ON "avaliacoes"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_evento_id_empresa_id_user_id_autor_key" ON "avaliacoes"("evento_id", "empresa_id", "user_id", "autor");

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
