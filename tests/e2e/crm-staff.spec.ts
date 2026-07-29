import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';

// Chạy trên Supabase LOCAL qua `npm run dev` (.env.local). Không đụng dữ liệu thật.
// Cần chạy scripts seed staff trước: e2e.b2c@ và e2e.b2b@ với vai trò staff.
const B2C = { email: 'e2e.b2c@dailongai.com', password: 'Test-1234!' };
const B2B = { email: 'e2e.b2b@dailongai.com', password: 'Test-1234!' };

// Mỗi lần chạy dùng số VÀ tên khác nhau. Tên phải duy nhất, nếu không dòng còn sót
// từ lần chạy trước sẽ làm assert đậu giả trong khi lệnh ghi thật đã hỏng.
const stamp = Date.now().toString().slice(-7);
const PHONE = `09${stamp}0`;
const PHONE_INTL = `+84${PHONE.slice(1)}`;
const HOA = `Chị Hoa E2E ${stamp}`;
const NAM = `Anh Nam E2E ${stamp}`;
const OPP = `Máy laser E2E ${stamp}`;

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/portal/login');
  await page.fill('#email', who.email);
  await page.fill('#password', who.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/portal/crm/accounts', { timeout: 20_000 });
}

async function logout(page: Page) {
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
  });
  await page.context().clearCookies();
}

test.describe.configure({ mode: 'serial' });

// Portal đoán ngôn ngữ từ navigator.language rồi nhớ vào localStorage['dl-locale'].
// Chromium của Playwright mặc định en-US nên phải ép về tiếng Việt, nếu không mọi
// nhãn trong bài test đều không khớp.
test.use({ locale: 'vi-VN' });
test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => localStorage.setItem('dl-locale', 'vi'));
  // Lỗi thật của trang không được lặng lẽ trôi qua.
  page.on('pageerror', e => { throw e; });
});

test('staff đăng nhập vào thẳng CRM và tạo được khách', async ({ page }) => {
  await login(page, B2C);
  await expect(page.getByRole('heading', { name: 'Khách hàng' })).toBeVisible();

  await page.getByRole('button', { name: 'Thêm khách hàng' }).click();
  await page.fill('#crm-acc-name', HOA);
  await page.fill('#crm-acc-phone', PHONE);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();

  // Bắt buộc thấy toast thành công — nếu lệnh ghi hỏng thì toast là lỗi, không phải cái này.
  await expect(page.getByText('Đã lưu khách hàng')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('cell', { name: HOA })).toBeVisible({ timeout: 15_000 });

  // Cột Trạng thái (thay cho cột Nhân viên phụ trách): khách mới chưa có cơ hội nào.
  await expect(page.getByRole('columnheader', { name: 'Trạng thái' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: HOA });
  await expect(row.getByText('Chưa có cơ hội')).toBeVisible();
});

test('mục 1 — nhân viên khác nhập lại cùng số (dạng +84) thì bị cảnh báo và bị DB chặn', async ({ page }) => {
  await login(page, B2B);

  // Nhân viên B2B không đọc được khách của B2C: bảng phải trống với tên đó.
  await expect(page.getByRole('cell', { name: HOA })).toHaveCount(0);

  await page.getByRole('button', { name: 'Thêm khách hàng' }).click();
  await page.fill('#crm-acc-name', 'Cũng chị Hoa');
  await page.fill('#crm-acc-phone', PHONE_INTL);
  await page.locator('#crm-acc-phone').blur();

  // Cảnh báo sớm: hiện tên khách đã có và ai đang phụ trách, dù RLS che bản ghi đó.
  await expect(page.getByText('Số điện thoại này đã có trong hệ thống')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(HOA)).toBeVisible();
  await expect(page.getByText('Nhân viên B2C')).toBeVisible();
  await expect(page.getByText(/xin bắn khách từ nhân viên đang phụ trách/)).toBeVisible();

  // Chốt chặn thật nằm dưới DB: bấm Lưu vẫn phải hỏng.
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText(/đã thuộc khách/)).toBeVisible({ timeout: 15_000 });
});

test('mục 3 — kéo cơ hội sang cột thua thì bắt buộc chọn lý do', async ({ page }) => {
  await login(page, B2C);

  await page.goto('/portal/crm/pipeline');
  await page.getByRole('button', { name: 'Thêm cơ hội' }).click();
  await page.selectOption('#crm-opp-account', { label: `${HOA} · ${PHONE}` });
  await page.fill('#crm-opp-name', OPP);
  await page.fill('#crm-opp-amount', '15000000');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText(OPP)).toBeVisible({ timeout: 15_000 });

  // Mở lại cơ hội, chuyển thẳng sang giai đoạn thua mà KHÔNG chọn lý do.
  await page.getByText(OPP).click();
  await page.selectOption('#crm-opp-stage', { label: 'Không mua · 0%' });
  await expect(page.locator('#crm-opp-lost-reason')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Phải chọn lý do mất')).toBeVisible({ timeout: 10_000 });

  // Chọn lý do rồi lưu lại thì qua, và ĐÚNG thẻ đó hiện nhãn lý do (các lần chạy
  // trước cũng để lại thẻ "Giá cao" nên phải soi trong thẻ của cơ hội này).
  await page.selectOption('#crm-opp-lost-reason', { label: 'Giá cao' });
  await page.fill('#crm-opp-lost-notes', 'Khách so hàng Trung Quốc rẻ hơn');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã lưu cơ hội')).toBeVisible({ timeout: 15_000 });
  const card = page.locator('article').filter({ hasText: OPP });
  await expect(card.getByText('Giá cao')).toBeVisible({ timeout: 15_000 });

  // Trạng thái khách chạy theo giai đoạn cơ hội, không phải nhập tay.
  await page.goto('/portal/crm/accounts');
  const row = page.getByRole('row').filter({ hasText: HOA });
  await expect(row.getByText('Không mua')).toBeVisible({ timeout: 15_000 });
});

test('mục 3b — kéo thẻ sang cột thua trên kanban thì hộp thoại lý do bật lên', async ({ page }) => {
  await login(page, B2C);
  await page.goto('/portal/crm/pipeline');

  const opp = `${OPP} keo tha`;
  await page.getByRole('button', { name: 'Thêm cơ hội' }).click();
  await page.selectOption('#crm-opp-account', { label: `${HOA} · ${PHONE}` });
  await page.fill('#crm-opp-name', opp);
  await page.fill('#crm-opp-amount', '9000000');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã lưu cơ hội')).toBeVisible({ timeout: 15_000 });

  // Kéo–thả HTML5 thật không mô phỏng được bằng mouse; bắn thẳng sự kiện mà
  // React đang lắng nghe (onDragStart / onDragOver / onDrop).
  const card = page.locator('article').filter({ hasText: opp }).first();
  const lostCol = page.locator('div').filter({ has: page.getByText('Không mua', { exact: true }) }).last();
  await card.dispatchEvent('dragstart');
  await lostCol.dispatchEvent('dragover');
  await lostCol.dispatchEvent('drop');

  // Hộp thoại phải bật, và bấm xác nhận khi chưa chọn lý do thì bị chặn.
  await expect(page.getByText('Vì sao mất cơ hội này?')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Xác nhận mất' }).click();
  await expect(page.getByText('Phải chọn lý do mất')).toBeVisible({ timeout: 10_000 });

  await page.selectOption('#lost-reason', { label: 'Mất liên lạc' });
  await page.getByRole('button', { name: 'Xác nhận mất' }).click();
  await expect(page.locator('article').filter({ hasText: opp }).getByText('Mất liên lạc')).toBeVisible({ timeout: 15_000 });
});

test('mục 4 — nhập Excel: đếm đúng trùng, chặn nhập trước khi kiểm tra, tạo được khách mới', async ({ page }) => {
  await login(page, B2C);

  // File có 4 dòng: 1 hợp lệ, 1 trùng số đã có trong DB, 1 trùng trong chính file, 1 thiếu tên.
  const rows = [
    ['Tên khách hàng', 'Số điện thoại', 'Tỉnh/TP', 'Ghi chú'],
    [NAM, `09${stamp}1`, 'Hà Nội', 'từ hội chợ'],
    [`Chị Hoa trùng ${stamp}`, PHONE_INTL, 'Hà Nội', 'trùng với khách đã có'],
    [`Anh Nam lặp lại ${stamp}`, `09${stamp}1`, 'Hà Nội', 'trùng trong file'],
    ['', `09${stamp}2`, 'Hà Nội', 'thiếu tên'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  await page.getByRole('button', { name: 'Nhập từ Excel' }).click();
  await page.setInputFiles('input[type="file"]', {
    name: 'khach.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buf,
  });

  // Đoán cột tự động từ tiêu đề tiếng Việt.
  await expect(page.locator('#imp-name')).toHaveValue('0');
  await expect(page.locator('#imp-phone')).toHaveValue('1');
  await expect(page.locator('#imp-province')).toHaveValue('2');

  // Chưa kiểm tra trùng thì nút nhập phải bị khoá.
  const runBtn = page.getByRole('button', { name: /^Nhập \(/ });
  await expect(runBtn).toBeDisabled();
  await expect(page.getByText('Phải kiểm tra trùng trước khi nhập.')).toBeVisible();

  await page.getByRole('button', { name: 'Kiểm tra trùng' }).click();

  // Sau khi kiểm tra: 1 nhập được, 1 thiếu tên, 1 trùng trong file, 1 đã có người phụ trách.
  await expect(page.getByRole('button', { name: 'Nhập (1)' })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByRole('cell', { name: 'Đã có người phụ trách', exact: false })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Trùng trong file', exact: false })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Thiếu tên', exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Nhập (1)' }).click();
  await expect(page.getByRole('cell', { name: NAM })).toBeVisible({ timeout: 20_000 });

  // Đúng một dòng được tạo, không phải cả 4.
  await expect(page.getByRole('cell', { name: `Anh Nam lặp lại ${stamp}` })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: `Chị Hoa trùng ${stamp}` })).toHaveCount(0);
});

test.afterEach(async ({ page }) => { await logout(page); });
