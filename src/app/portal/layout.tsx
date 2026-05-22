import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="laser-grid min-h-screen bg-[#121416] font-body antialiased text-[#e2e2e5]">
      <AuthProvider>{children}</AuthProvider>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
}
