import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth-context';

const PORTAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;vertical-align:middle;}
.material-symbols-outlined.fill{font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;}
.portal-scroll::-webkit-scrollbar{width:4px;height:4px;}
.portal-scroll::-webkit-scrollbar-track{background:#121416;}
.portal-scroll::-webkit-scrollbar-thumb{background:#ff5625;border-radius:2px;}
.portal-glass{background:rgba(30,32,34,0.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid rgba(255,181,160,0.15);border-left:1px solid rgba(255,181,160,0.1);}
.portal-grid{background-image:radial-gradient(rgba(255,86,37,0.06) 1px, transparent 1px);background-size:40px 40px;}
`;

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="portal-scroll portal-grid min-h-screen bg-[#0a0c0f] font-body antialiased text-[#e7eaf0]">
      <style>{PORTAL_CSS}</style>
      <AuthProvider>{children}</AuthProvider>
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
}
