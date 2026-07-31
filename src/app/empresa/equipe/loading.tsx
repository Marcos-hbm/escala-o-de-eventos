import { SkeletonRegiao, SkeletonTitulo, SkeletonCards } from "@/components/ui/skeleton";

/** Streaming do App Router: aparece enquanto a consulta ao banco não volta. */
export default function Loading() {
  return (
    <SkeletonRegiao>
      <SkeletonTitulo />
      <div className="mt-6">
        <SkeletonCards quantidade={3} />
      </div>
    </SkeletonRegiao>
  );
}
