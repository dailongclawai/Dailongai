'use client';

const SHIMMER_CSS = `
@keyframes portal-skeleton-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.portal-skeleton {
  background: linear-gradient(90deg, #1a1f26 25%, #232830 50%, #1a1f26 75%);
  background-size: 800px 100%;
  animation: portal-skeleton-shimmer 1.4s infinite linear;
  border-radius: 6px;
}
`;

interface BlockProps {
  w?: string;
  h?: string;
  className?: string;
}

function Block({ w = 'w-full', h = 'h-4', className = '' }: BlockProps) {
  return <div className={`portal-skeleton ${w} ${h} ${className}`} />;
}

function ShimmerStyles() {
  return <style>{SHIMMER_CSS}</style>;
}

function Dashboard() {
  return (
    <div className="space-y-10 py-4">
      <ShimmerStyles />
      <div className="space-y-3">
        <Block w="w-40" h="h-3" />
        <Block w="w-2/3 md:w-1/3" h="h-10" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="space-y-4 md:col-span-7">
          <Block w="w-28" h="h-3" />
          <Block w="w-full md:w-3/4" h="h-16" />
          <Block w="w-40" h="h-3" />
          <Block w="w-full" h="h-9" className="mt-2" />
        </div>
        <div className="space-y-3 md:col-span-5">
          <Block h="h-32" className="rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Block h="h-20" className="rounded-xl" />
            <Block h="h-20" className="rounded-xl" />
          </div>
        </div>
      </div>
      <Block h="h-48" className="rounded-3xl" />
      <div className="space-y-3">
        <Block w="w-32" h="h-3" />
        <Block h="h-12" />
        <Block h="h-12" />
        <Block h="h-12" />
      </div>
    </div>
  );
}

function Cards({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-6 py-4">
      <ShimmerStyles />
      <Block w="w-1/3" h="h-8" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <Block key={i} h="h-40" className="rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function Table({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-4">
      <ShimmerStyles />
      <Block w="w-1/3" h="h-8" />
      <Block h="h-10" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Block key={i} h="h-14" />
        ))}
      </div>
    </div>
  );
}

function Ledger() {
  return (
    <div className="space-y-6 py-4">
      <ShimmerStyles />
      <Block w="w-1/3" h="h-8" />
      <div className="space-y-3">
        <Block w="w-48" h="h-5" />
        <Block h="h-24" className="rounded-2xl" />
        <Block h="h-24" className="rounded-2xl" />
      </div>
      <div className="space-y-3">
        <Block w="w-48" h="h-5" />
        <Block h="h-24" className="rounded-2xl" />
      </div>
    </div>
  );
}

function Timeline({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-4">
      <ShimmerStyles />
      <Block w="w-1/4" h="h-6" />
      <div className="space-y-3 pl-6">
        {Array.from({ length: rows }).map((_, i) => (
          <Block key={i} h="h-12" />
        ))}
      </div>
    </div>
  );
}

export const PortalSkeleton = {
  Dashboard,
  Cards,
  Table,
  Ledger,
  Timeline,
  Block,
};

export { Block as SkeletonBlock };
