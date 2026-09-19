import { cn } from "../lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 && "w-2/3")} />
      ))}
    </div>
  );
}

export function ResultSkeleton() {
  return (
    <div className="card space-y-5 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <SkeletonLines lines={3} className="pt-1" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}