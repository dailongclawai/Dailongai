import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';

const PORTAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;vertical-align:middle;}
.material-symbols-outlined.fill{font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;}
.portal-scroll::-webkit-scrollbar{width:6px;height:6px;}
.portal-scroll::-webkit-scrollbar-track{background:#180b07;}
.portal-scroll::-webkit-scrollbar-thumb{background:#5b4039;border-radius:10px;}
.portal-glass{background:rgba(44,28,23,0.7);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(91,64,57,0.4);}
`;

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="portal-scroll min-h-screen bg-[#1e100c] font-body antialiased text-[#fadcd5]">
      <style>{PORTAL_CSS}</style>
      <AuthProvider>{children}</AuthProvider>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
}
