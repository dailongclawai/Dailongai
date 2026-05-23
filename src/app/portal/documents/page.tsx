'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { getSalesDocuments, getSalesDocUrl } from '@/lib/portal-queries';
import type { SalesDocument, DocCategory } from '@/lib/portal-types';

const catLabel: Record<DocCategory, string> = {
  catalog: 'Catalog', video: 'Video', contract_template: 'Mẫu hợp đồng', manual: 'Hướng dẫn',
};
const catIcon: Record<DocCategory, string> = { catalog: '📘', video: '🎬', contract_template: '📄', manual: '📐' };

export default function DocumentsPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [docs, setDocs] = useState<SalesDocument[]>([]);

  const refresh = useCallback(async () => { setDocs(await getSalesDocuments()); }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/portal/login');
    else void refresh();
  }, [loading, session, router, refresh]);

  if (loading || !session) return null;

  const open = async (doc: SalesDocument) => {
    const url = await getSalesDocUrl(doc.file_url);
    if (url) window.open(url, '_blank');
    else toast.error('Không mở được tệp');
  };

  const variant = (profile?.role === 'supervisor' || profile?.role === 'admin') ? profile.role : 'dealer';
  const dashHref = profile?.role === 'admin' ? '/portal/admin' : profile?.role === 'supervisor' ? '/portal/supervisor' : '/portal/dashboard';

  return (
    <PortalShell
      variant={variant}
      nav={<Link href={dashHref} className="text-[#e2e2e5]/60 transition-colors hover:text-[#ff5625]">← Bảng điều khiển</Link>}
    >
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Tài nguyên</p>
        <h1 className="mt-2 font-headline text-4xl">Tài liệu bán hàng</h1>
        <p className="mt-2 text-sm text-[#e2e2e5]/60">Catalog, mẫu hợp đồng, video và hướng dẫn dành cho bạn.</p>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#3d3f41]/50 p-12 text-center text-sm text-[#e2e2e5]/60">
          Chưa có tài liệu nào được chia sẻ.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => open(d)}
              className="group flex flex-col rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022] p-5 text-left transition-colors hover:border-[#ff5625]/50"
            >
              <span className="text-2xl">{catIcon[d.category]}</span>
              <span className="mt-3 font-medium text-[#e2e2e5] group-hover:text-[#ff5625]">{d.title}</span>
              <span className="mt-1 text-[11px] uppercase tracking-wider text-[#e2e2e5]/50">{catLabel[d.category]}</span>
              <span className="mt-4 text-xs text-[#ff5625]">Mở tài liệu →</span>
            </button>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
