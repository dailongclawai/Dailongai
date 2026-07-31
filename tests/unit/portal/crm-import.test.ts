import { describe, it, expect } from 'vitest';
import { normPhone, nenLapCoHoi } from '@/components/portal/CrmImportDialog';

// Các cặp dưới đây phải cho ra kết quả giống hệt public.crm_normalize_phone
// (supabase/migrations/20260728120000_crm_account_phone_dedupe.sql). Nếu một bên
// đổi mà bên kia không đổi thì bảng đếm trùng lúc nhập file sẽ báo sai.
describe('normPhone', () => {
  it('quy mọi cách viết của cùng một số về một chuỗi', () => {
    for (const raw of ['0912345678', '0912 345 678', '+84912345678', '84912345678', '091-234-5678']) {
      expect(normPhone(raw)).toBe('0912345678');
    }
  });

  it('bỏ tiền tố 840 khi người dùng gõ +840...', () => {
    expect(normPhone('+840912345678')).toBe('0912345678');
  });

  it('trả chuỗi rỗng khi không có chữ số nào', () => {
    expect(normPhone('')).toBe('');
    expect(normPhone('không rõ')).toBe('');
  });

  it('giữ nguyên số không theo định dạng Việt Nam thay vì đoán bừa', () => {
    expect(normPhone('12345')).toBe('12345');
  });
});

// Boss báo 01/08/2026: khách ghi "Không mua" mà bảng Cơ hội vẫn bày một thương vụ
// đang chạy. Gốc là lúc nhập file, dòng nào có số máy thì lập cơ hội ở bước mở đầu
// chuỗi mà không nhìn cột Trạng thái. Cơ hội ở bước thua bắt buộc có lý do mất
// (trigger dưới DB chặn) mà Excel không mang thông tin đó, nên dòng "Không mua"
// phải bỏ qua việc lập cơ hội.
describe('nenLapCoHoi', () => {
  it('có số máy và giai đoạn đang mở thì lập cơ hội', () => {
    expect(nenLapCoHoi(1, 'open')).toBe(true);
    expect(nenLapCoHoi(5, 'open')).toBe(true);
  });

  it('khách Không mua thì KHÔNG lập, dù có điền số máy', () => {
    expect(nenLapCoHoi(3, 'lost')).toBe(false);
  });

  it('khách Hoàn thành đơn vẫn lập, vì trigger đẩy cơ hội sang bước hoàn thành', () => {
    expect(nenLapCoHoi(2, 'won')).toBe(true);
  });

  it('bỏ trống hoặc số không hợp lệ thì không lập', () => {
    expect(nenLapCoHoi(0, 'open')).toBe(false);
    expect(nenLapCoHoi(-1, 'open')).toBe(false);
    expect(nenLapCoHoi(NaN, 'open')).toBe(false);
  });

  it('không điền cột Trạng thái thì vẫn lập bình thường', () => {
    expect(nenLapCoHoi(1, null)).toBe(true);
  });
});
