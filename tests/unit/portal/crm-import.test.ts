import { describe, it, expect } from 'vitest';
import { normPhone } from '@/components/portal/CrmImportDialog';

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
