# Spec addendum — Zalo OA OTP for phone-based signup

**Date:** 2026-05-22
**Decision by:** Boss (chọn Zalo OA thay vì Twilio để 0đ + reach VN users)

## Context

Spec gốc [2026-05-21-dailongai-portal-design.md](2026-05-21-dailongai-portal-design.md) section 5.1 đề cập OAuth Google/Facebook + email fallback. Boss yêu cầu thêm 4th method: **đăng ký bằng số điện thoại** (OTP) — và chọn Zalo OA làm SMS provider (free, custom code).

## Flow

```
User mobile/web:
1. Click "Đăng ký bằng SĐT" → input phone (e.g. 0901234567)
2. Submit → POST /functions/v1/send-otp { phone }
3. Receive OTP 6-digit qua Zalo OA personal message
4. Input 6 digits → POST /functions/v1/verify-otp { phone, code }
5. On 200: receive Supabase session JWT + redirect /portal/onboarding
```

## Components needed

### DB
- New table `phone_otp` (id, phone TEXT, code_hash TEXT, expires_at, attempts INT default 0, used BOOL default FALSE).
- Index on `(phone, expires_at DESC)`.
- Trigger to delete rows > 24h old (or cron).

### Edge Functions (Supabase Deno)
1. **`send-otp`** (`supabase/functions/send-otp/index.ts`):
   - Validate phone format `^0\d{9,10}$`
   - Generate 6-digit code (`crypto.randomInt`)
   - Hash with `crypto.subtle.digest('SHA-256', code)`
   - INSERT into `phone_otp` with `expires_at = now() + 5 min`
   - Rate-limit: max 3 OTP/phone/hour
   - Call Zalo OA API to send message:
     ```
     POST https://openapi.zalo.me/v3.0/oa/message/cs
     Headers: access_token=<token>
     Body: { recipient: { user_id }, message: { text: "Mã OTP Đại Long: 123456 (hiệu lực 5 phút)" } }
     ```
   - Problem: Zalo OA `message/cs` requires user_id (not phone). User must `follow` OA first → we have `user_id`.
   - Alternative: send via `phone` is NOT supported by Zalo OA (only via `user_id`).
   - **Workaround**: For new users (phone not yet linked to OA), fallback to:
     - Generate QR code with phone embedded → user scan QR opens Zalo OA → bot recognizes phone → sends OTP
     - OR fallback to Twilio SMS as backup for phones not on Zalo

### Lookup phone → Zalo user_id
- Boss's Zalo bot at `/Users/agentopenclaw/app/conversations.db` SQLite may already have phone↔user_id mapping from existing customer chats
- New `phone_user_map` table syncs from Zalo bot DB nightly (or call Zalo lookup API)

### Client UI
- New page `/portal/phone-signup`:
  - Step 1: phone input + "Gửi mã"
  - Step 2: 6-digit OTP input + "Xác minh" + "Gửi lại sau 60s" countdown
  - Step 3 (on verify success): redirect to `/portal/onboarding`

### Integration with profile auto-create
- After OTP verify, server creates `auth.users` row with `phone` column populated → `handle_new_user()` trigger fires → profile created with status=pending
- Email may be null → admin onboarding flow needs to handle missing email gracefully

## Edge cases

1. **Phone not on Zalo**: OTP cannot be sent via OA → fallback Twilio (Plan 4 paid backup) OR error message "SĐT chưa có Zalo, vui lòng cài Zalo + follow OA Đại Long"
2. **OTP timeout** (5 min): user re-request, rate-limit 3/hour
3. **Brute force OTP**: 5 wrong attempts → lock OTP for 1 hour
4. **Phone collision** (user signs up SĐT đã có account): error message + link to "đăng nhập"
5. **Phone change**: profile management page allows re-verify new phone

## Cost estimate

- Zalo OA: 0đ per OTP (within OA quota limits — check Zalo policy for transactional messaging)
- Twilio fallback (~5% of users without Zalo): $0.04 × 5% × 100 signups/month = $0.20/month negligible
- Total: ~0đ for v1 scale (~20-50 dealers)

## Plan 2 inclusion

Add as **Task 14.5** (between Profile page + E2E):
- New migration: `phone_otp` table + cleanup function
- New edge functions: `send-otp` + `verify-otp`
- New page: `/portal/phone-signup`
- New button on `/portal/login` + `/portal/register`: "Đăng ký bằng SĐT"
- Integration: Zalo OA send-message wrapper

Estimated: ~6-8 hours implementation + 2h Zalo OA integration testing.

## Plan 4 future enhancement

- Twilio SMS fallback for phones without Zalo
- Phone-only login (skip OTP if device trusted via JWT cookie)
- Voice OTP fallback for elderly users
