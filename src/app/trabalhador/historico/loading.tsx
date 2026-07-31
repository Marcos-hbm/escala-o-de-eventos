import { SkeletonRegiao, SkeletonTitulo, SkeletonTabela } from "@/components/ui/skeleton";

/** Streaming do App Router: aparece enquanto a consulta ao banco não volta. */
export default function Loading() {
  return (
    <SkeletonRegiao>
      <SkeletonTitulo />
      <div className="mt-6">
        <SkeletonTabela linhas={5} colunas={3} />
      </div>
    </SkeletonRegiao>
  );
}
