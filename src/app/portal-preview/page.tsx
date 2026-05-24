'use client';
// PROTOTYPE — Dashboard design preview. Boss xem, chọn, rồi xóa cả folder.
// 3 variants of post-login dealer dashboard, switchable via ?variant=A|B|C.

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { VariantA, variantAName } from './VariantA';
import { VariantB, variantBName } from './VariantB';
import { VariantC, variantCName } from './VariantC';
import { VariantD, variantDName } from './VariantD';
import { PrototypeSwitcher } from './PrototypeSwitcher';

const variants = [
  { key: 'D', name: variantDName, Comp: VariantD },
  { key: 'A', name: variantAName, Comp: VariantA },
  { key: 'B', name: variantBName, Comp: VariantB },
  { key: 'C', name: variantCName, Comp: VariantC },
];

function PreviewInner() {
  const sp = useSearchParams();
  const current = (sp?.get('variant') ?? 'D').toUpperCase();
  const match = variants.find((v) => v.key === current) ?? variants[0];
  const ActiveComp = match.Comp;

  return (
    <>
      <ActiveComp />
      <PrototypeSwitcher variants={variants.map(({ key, name }) => ({ key, name }))} current={match.key} />
    </>
  );
}

export default function PortalPreviewPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-500">Đang tải prototype…</div>}>
      <PreviewInner />
    </Suspense>
  );
}
