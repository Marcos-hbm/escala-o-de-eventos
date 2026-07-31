import { SkeletonRegiao, SkeletonTitulo, SkeletonKpis, SkeletonCards } from "@/components/ui/skeleton";

/** Streaming do App Router: aparece enquanto a consulta ao banco não volta. */
export default function Loading() {
  return (
    <SkeletonRegiao>
      <SkeletonTitulo />
      <div className="mt-6 space-y-6">
        <SkeletonKpis />
        <SkeletonCards quantidade={2} />
      </div>
    </SkeletonRegiao>
  );
}
