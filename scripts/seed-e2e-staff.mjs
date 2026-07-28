// Tạo 2 tài khoản staff trên Supabase LOCAL cho bộ E2E tests/e2e/crm-staff.spec.ts.
// Khoá lấy từ `supabase status`, không in ra ngoài. Chạy lại được nhiều lần.
//
//   node scripts/seed-e2e-staff.mjs
//   npx next dev -p 3100
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/e2e/crm-staff.spec.ts
import { execSync } from 'node:child_process';

const raw = execSync('supabase status -o env', { encoding: 'utf8' });
const env = Object.fromEntries(
  raw.split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
  }),
);
const URL = env.API_URL || 'http://127.0.0.1:54321';
const SERVICE = env.SERVICE_ROLE_KEY;
if (!SERVICE) {
  console.error('Không lấy được service role key. Chạy `supabase start` trước.');
  process.exit(1);
}

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const USERS = [
  { email: 'e2e.b2c@dailongai.com', password: 'Test-1234!', name: 'Nhân viên B2C', segment: 'b2c' },
  { email: 'e2e.b2b@dailongai.com', password: 'Test-1234!', name: 'Nhân viên B2B', segment: 'b2b' },
];

for (const u of USERS) {
  const list = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: H }).then(r => r.json());
  const old = (list.users || []).find(x => x.email === u.email);
  if (old) await fetch(`${URL}/auth/v1/admin/users/${old.id}`, { method: 'DELETE', headers: H });

  const created = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true }),
  }).then(r => r.json());

  if (!created.id) {
    console.error('Tạo tài khoản thất bại:', u.email, JSON.stringify(created));
    process.exit(1);
  }

  const patched = await fetch(`${URL}/rest/v1/profiles?id=eq.${created.id}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ role: 'staff', status: 'active', full_name: u.name, staff_segment: u.segment }),
  }).then(r => r.json());

  const row = Array.isArray(patched) ? patched[0] : patched;
  console.log(`${u.email} -> role=${row?.role} segment=${row?.staff_segment} status=${row?.status}`);
}
