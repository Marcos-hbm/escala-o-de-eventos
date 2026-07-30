import "server-only";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp"];

/**
 * Salva uma imagem de perfil enviada via formData e retorna o caminho público
 * (ex.: "/uploads/abc.png"), ou null se não houver arquivo válido.
 * Valida tipo e tamanho (defesa básica de upload).
 */
export async function salvarFotoPerfil(file: File | null, prefixo: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_BYTES) {
    throw new Error("Imagem muito grande (máximo 2 MB).");
  }
  if (!TIPOS_OK.includes(file.type)) {
    throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  // Nome sem dados aleatórios instáveis: prefixo + timestamp.
  const nome = `${prefixo}_${Date.now()}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, nome), buffer);

  return `/uploads/${nome}`;
}
