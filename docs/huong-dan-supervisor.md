# Hướng dẫn sử dụng Portal — dành cho Supervisor

> Supervisor là **trưởng nhánh kinh doanh** của Đại Long Medical: mời đại lý vào nhánh, theo dõi toàn bộ số liệu bán hàng của đội, điều chỉnh mức hoa hồng từng đại lý và rút hoa hồng cá nhân.

---

## Mục lục

1. [Tổng quan vai trò Supervisor](#1-tổng-quan-vai-trò-supervisor)
2. [Đăng nhập](#2-đăng-nhập)
3. [Tài khoản nhận hoa hồng](#3-tài-khoản-nhận-hoa-hồng)
4. [QR riêng — mời đại lý vào nhánh](#4-qr-riêng--mời-đại-lý-vào-nhánh)
5. [Trang Tổng — đội ngũ & sổ hoa hồng](#5-trang-tổng)
6. [Quản lý đại lý — Tab "Đội ngũ"](#6-tab-đội-ngũ)
7. [Chi tiết đại lý — chỉnh hoa hồng](#7-chi-tiết-đại-lý)
8. [Tab "Sổ hoa hồng" — xem & rút tiền](#8-tab-sổ-hoa-hồng)
9. [Bảng tier auto vs. override cố định](#9-tier-auto-vs-override-cố-định)

---

## 1. Tổng quan vai trò Supervisor

```
 ┌─────────────────────────────────────────────────┐
 │            SUPERVISOR (nhánh)                   │
 │           Hoa hồng nhánh: 5% trên               │
 │           toàn bộ doanh số đội ngũ              │
 └────────────────────┬────────────────────────────┘
                      │ mời qua QR/link
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌────────┐    ┌────────┐    ┌────────┐
   │Dealer A│    │Dealer B│    │Dealer C│
   │ 15-25% │    │ 15-25% │    │ 6tr/máy│
   └────────┘    └────────┘    └────────┘
```

**Supervisor có quyền:**

- Xem **toàn bộ KPI và đơn hàng** của mọi đại lý trong nhánh (read-only).
- **Override hoa hồng** cho từng đại lý (tier % auto hoặc cố định/máy).
- **Mời đại lý mới** bằng QR/link riêng — đại lý đăng ký qua đây sẽ tự động thuộc nhánh.
- **Nhận hoa hồng riêng** cho doanh số nhánh; rút tiền giống đại lý.

**Supervisor KHÔNG có quyền:**

- Duyệt đơn (quyền của admin Đại Long).
- Tự gán supervisor cho người khác (chỉ admin Đại Long làm được).
- Xem dữ liệu nhánh khác.

---

## 2. Đăng nhập

URL: `https://dailongai.com/portal/login`

```
 ┌───────────────────────────────────┐
 │           ĐĂNG NHẬP               │
 │                                   │
 │   [ Tiếp tục với Google ]         │
 │   [ Tiếp tục với Apple  ]         │
 │                                   │
 │   ── HOẶC ────────────────        │
 │   Email:    [_____________]       │
 │   Mật khẩu: [_____________]       │
 │              Quên mật khẩu?       │
 │   [  Đăng nhập  ]                 │
 └───────────────────────────────────┘
```

- Đăng nhập xong, Portal tự đưa supervisor vào trang `/portal/supervisor`.
- Nếu vừa được admin nâng từ "đại lý" lên "supervisor", đăng xuất + đăng nhập lại để cập nhật role.

---

## 3. Tài khoản nhận hoa hồng

> **Bắt buộc.** Không có TK ngân hàng → không rút được tiền nhánh.

Menu góc trên phải → **Tài khoản nhận hoa hồng** (URL `/portal/payout-info`).

```
 ┌──────────────────────────────────────────────────┐
 │ ✓ VERIFIED — Đã xác minh                         │
 │ Tài khoản sẵn sàng nhận thanh toán hoa hồng.     │
 ├──────────────────────────────────────────────────┤
 │ Ngân hàng:    [ Vietcombank          ▼ ]         │
 │ Số tài khoản: [ 1234567890               ]       │
 │ Chủ TK:       [ NGUYEN VAN A             ]       │
 │                                                  │
 │                            [  Lưu thông tin  ]   │
 └──────────────────────────────────────────────────┘
```

Quy tắc: chủ TK **in hoa, không dấu**, số TK 6–20 chữ số.

---

## 4. QR riêng — mời đại lý vào nhánh

> **Đây là cách bành trướng nhánh.** Đại lý đăng ký qua QR/link này sẽ TỰ ĐỘNG thuộc nhánh của supervisor — không phải khai báo gì.

URL: `/portal/supervisor/qr`

```
 ┌─────────────────────────────────────────────────┐
 │   MỜI ĐẠI LÝ VÀO NHÁNH                          │
 │   QR riêng của bạn                              │
 ├─────────────────────────────────────────────────┤
 │                                                 │
 │        ┌─────────────────┐                      │
 │        │ ▓▓▓ ▓▓ ▓▓▓ ▓▓▓  │                      │
 │        │ ▓ █ ▓▓▓▓ ▓▓▓ ▓  │  QR mời              │
 │        │ ▓ ▓▓▓ ▓▓ ▓ ▓▓▓  │  Nguyen Van Supervisor│
 │        │ ▓▓▓ ▓▓ ▓▓▓ ▓▓▓  │                      │
 │        └─────────────────┘                      │
 │                                                 │
 │   Link mời riêng                                │
 │   🔗 dailongai.com/portal/register?ref=XXXX     │
 │                                                 │
 │   [ Copy link ]   [ ⬇ Tải QR ]                  │
 │                                                 │
 │   💡 In QR ra dán điểm bán, hoặc gửi Zalo/email │
 │      cho đại lý mới.                            │
 └─────────────────────────────────────────────────┘
```

**Cách dùng:**

1. **Tải QR** → in name-card / banner / dán quầy.
2. Hoặc **Copy link** → gửi qua Zalo / SMS / email cho người định mời.
3. Họ đăng ký bằng Google/Apple/email qua link đó → admin duyệt → tự nhảy vào nhánh.

> ⚠️ Nếu họ vào thẳng `/portal/register` (không qua link mời) → đại lý sẽ KHÔNG gắn vào nhánh nào. Luôn ép họ dùng đúng link/QR của supervisor.

---

## 5. Trang Tổng

URL: `/portal/supervisor` — đây là **trang chính** của supervisor.

```
 ┌──────────────────────────────────────────────────────────┐
 │  SUPERVISOR                          👤 Nguyen Van S      │
 │  Nguyen Van Supervisor · điều phối nhánh                 │
 │                                                          │
 │  [ ▣ Đội ngũ ]   [ ₫ Sổ hoa hồng ]    ← 2 TAB chính       │
 ├──────────────────────────────────────────────────────────┤
 │                                                          │
 │  ┌─ Hoa hồng nhánh ─────────────────────────────────┐    │
 │  │ Đã nhận tổng cộng: 42.500.000 ₫                  │    │
 │  │ Số dư khả dụng:    18.750.000 ₫                  │    │
 │  │                            [ Yêu cầu tất toán ]  │    │
 │  └──────────────────────────────────────────────────┘    │
 │                                                          │
 │  ...(nội dung theo tab đang chọn)                        │
 │                                                          │
 └──────────────────────────────────────────────────────────┘
```

Phía trên là banner **Hoa hồng nhánh** — luôn hiển thị bất kể tab nào.

Bên dưới là 2 tab:

- **Đội ngũ** — danh sách đại lý + KPI tổng nhánh.
- **Sổ hoa hồng** — lịch sử hoa hồng từ đội + lịch sử rút tiền.

URL có query param: `?tab=team` hoặc `?tab=commission` (bấm tab sẽ tự đổi URL).

---

## 6. Tab "Đội ngũ"

```
 ┌────────────────────────────────────────────────────────┐
 │  KPI TỔNG NHÁNH                                        │
 │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
 │  │ ĐẠI LÝ TRONG │ │ ACTIVE THÁNG │ │ ĐƠN CHỜ      │    │
 │  │     ĐỘI      │ │     NÀY      │ │   DUYỆT      │    │
 │  │      8       │ │      5       │ │     12       │    │
 │  └──────────────┘ └──────────────┘ └──────────────┘    │
 │                                                        │
 │  DANH SÁCH ĐẠI LÝ                                      │
 │  ┌──────────────────────────────────────────────────┐  │
 │  │  Nguyen Van A          [Tier 2 · 20%]            │  │
 │  │  ───────────────────────────────────────         │  │
 │  │  Doanh số: 180tr  | Máy YTD: 12 | Chờ: 2         │  │
 │  │                              [Xem chi tiết →]    │  │
 │  ├──────────────────────────────────────────────────┤  │
 │  │  Tran Thi B            [Override · 6tr/máy]      │  │
 │  │  ───────────────────────────────────────         │  │
 │  │  Doanh số: 95tr   | Máy YTD: 4  | Chờ: 1         │  │
 │  │                              [Xem chi tiết →]    │  │
 │  └──────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────┘
```

**Đọc nhanh:**

- **Đại lý trong đội** — tổng số đại lý đã được admin duyệt và gắn vào nhánh.
- **Active tháng này** — số đại lý đã chốt ≥ 1 đơn trong tháng.
- **Đơn chờ duyệt** — tổng đơn pending của cả nhánh (admin Đại Long sẽ duyệt).

Mỗi đại lý là 1 card. Tag bên phải tên hiển thị mức hoa hồng **đang áp dụng**:

| Tag | Ý nghĩa |
|-----|---------|
| `Tier 1 · 15%` (xanh lá) | Đang dùng tier auto (theo số máy YTD) |
| `Tier 2 · 20%` (xanh lá) | Đã chốt ≥ 101 máy → lên Tier 2 |
| `Override · 6tr/máy` (cam) | Supervisor đã đặt mức cố định cho đại lý này |

Bấm **Xem chi tiết →** để vào trang quản lý hoa hồng đại lý đó.

---

## 7. Chi tiết đại lý

URL: `/portal/supervisor/team?dealer=<id>`

```
 ┌─────────────────────────────────────────────────────────┐
 │  ← Về đội                                               │
 │  Chi tiết đại lý: Nguyen Van A                          │
 │                                                         │
 │  ┌─────┐ ┌──────────────┐ ┌─────┐ ┌─────┐               │
 │  │MÁY  │ │ DOANH SỐ     │ │ ĐƠN │ │ ĐÃ  │               │
 │  │ YTD │ │ THÁNG        │ │ CHỜ │ │CHỐT │               │
 │  │  12 │ │ 180.000.000  │ │  2  │ │ 10  │               │
 │  └─────┘ └──────────────┘ └─────┘ └─────┘               │
 │                                                         │
 │  ┌─ TIER TỰ ĐỘNG ──────────┐ ┌─ OVERRIDE CỐ ĐỊNH/MÁY ─┐ │
 │  │ Tier 2 · Bậc 2          │ │ [Đang áp dụng] (nếu có)│ │
 │  │ Đã chốt 12 máy năm nay  │ │                        │ │
 │  │                         │ │ Số tiền/máy:           │ │
 │  │             20%         │ │  6.000.000 ₫           │ │
 │  │         trên giá bán    │ │                        │ │
 │  │                         │ │ ───●─────────────  ($) │ │
 │  │ 101 máy → 20%           │ │ 4.500.000 ─ 12.000.000 │ │
 │  │ 201 máy → 25%           │ │                        │ │
 │  └─────────────────────────┘ │ [ Lưu fixed ]          │ │
 │                              │ ⌫ Bỏ override, dùng    │ │
 │                              │   tier auto            │ │
 │                              └────────────────────────┘ │
 │                                                         │
 │  LỊCH SỬ ĐƠN                                            │
 │  Serial      Khách     Giá          Trạng thái          │
 │  SN-001234   Chị Lan   45.000.000   Đã duyệt            │
 │  SN-001235   Anh Hùng  42.000.000   Chờ duyệt           │
 └─────────────────────────────────────────────────────────┘
```

### Cách đặt mức hoa hồng cố định

1. Kéo thanh slider hoặc gõ số vào ô (giới hạn **4.500.000 – 12.000.000 ₫/máy**, bước nhảy 500k).
2. Bấm **Lưu fixed** → tag chuyển sang **Override · X tr/máy** (cam).
3. Từ thời điểm này, mọi đơn mới của đại lý sẽ tính hoa hồng theo số tiền cố định (không theo %).

### Cách quay về tier auto

- Bấm **⌫ Bỏ override, dùng tier auto** → trở về tính theo % (15/20/25 tuỳ số máy YTD).

> 💡 **Khi nào nên dùng cố định/máy?**
>
> - Đại lý mới, doanh số thấp → đặt cố định cao hơn % để khuyến khích.
> - Sản phẩm khuyến mãi giá thấp → cố định/máy đảm bảo đại lý không lỗ.
> - Đại lý VIP / hợp đồng riêng → cố định/máy theo thoả thuận với Boss.

---

## 8. Tab "Sổ hoa hồng"

URL: `/portal/supervisor?tab=commission`

```
 ┌────────────────────────────────────────────────────────────┐
 │  SỔ HOA HỒNG TỪ ĐỘI                                        │
 │                                                            │
 │  Trạng thái: [ Tất cả ▼ ]                                  │
 │  Thời gian:  [ Tháng này ▼ ]                               │
 │  Tìm kiếm:   [______________]                              │
 │                                                            │
 │  ┌──────────────────────────────────────────────────────┐  │
 │  │  Ngày      Đại lý         Đơn       HH    T.Thái     │  │
 │  │  22/05     Nguyen Van A   SN-001234 9tr   Đã duyệt   │  │
 │  │  20/05     Tran Thi B     SN-001220 6tr   Đã tất toán│  │
 │  │  ...                                                 │  │
 │  └──────────────────────────────────────────────────────┘  │
 │                                                            │
 │  YÊU CẦU TẤT TOÁN CỦA TÔI                                  │
 │  ┌────────────────────────────────────────────────────┐    │
 │  │ Mã        Số tiền       Ngày          Trạng thái   │    │
 │  │ PO-0042   12.000.000    20/05/26      Đã chuyển    │    │
 │  │ PO-0043    6.750.000    23/05/26      Đang xử lý   │    │
 │  └────────────────────────────────────────────────────┘    │
 └────────────────────────────────────────────────────────────┘
```

### Cách rút hoa hồng cá nhân

1. Quay lên banner phía trên trang `/portal/supervisor`, xem **Số dư khả dụng**.
2. Bấm **Yêu cầu tất toán** → modal hiện:

```
 ┌─────────────────────────────────────┐
 │   YÊU CẦU TẤT TOÁN                  │
 │                                     │
 │   Số tiền yêu cầu (₫)               │
 │   [ 12000000                  ]     │
 │                                     │
 │   Ghi chú (tuỳ chọn)                │
 │   [ Tất toán đợt tháng 5      ]     │
 │                                     │
 │   [ Huỷ ]      [ Gửi yêu cầu ]      │
 └─────────────────────────────────────┘
```

3. Nhập số tiền (≤ số dư khả dụng), bấm **Gửi yêu cầu**.
4. Kế toán Đại Long chuyển khoản về **TK ngân hàng đã verify** (mục 3).
5. Theo dõi trạng thái trong bảng **Yêu cầu tất toán của tôi**.

---

## 9. Tier auto vs. Override cố định

| | **Tier auto (%)** | **Override cố định (₫/máy)** |
|---|---|---|
| Mặc định | ✓ Tất cả đại lý mới | ✗ Tắt |
| Công thức | % × giá bán thực tế | Số tiền cố định × số máy |
| Tier 1 | 0 – 100 máy → **15 %** | — |
| Tier 2 | 101 – 200 máy → **20 %** | — |
| Tier 3 | 201+ máy → **25 %** | — |
| Range | (không) | 4.500.000 – 12.000.000 ₫/máy |
| Ai chỉnh được | Tự động theo số máy YTD | Supervisor đặt thủ công |
| Khi nào dùng | Đại lý chạy ổn định | Đại lý mới / VIP / sản phẩm khuyến mãi |

> ⚙️ Override **đè lên** tier auto. Bỏ override → quay về tier auto.

---

## Câu hỏi thường gặp

**Q: Tôi không thấy 1 đại lý dù đã mời họ đăng ký?**
A: 3 nguyên nhân: (1) họ đăng ký không qua link mời của supervisor; (2) admin Đại Long chưa duyệt; (3) admin chưa gán role "dealer". Liên hệ admin xác nhận.

**Q: Tôi đổi override hoa hồng có ảnh hưởng đơn cũ không?**
A: KHÔNG. Override chỉ áp dụng cho **đơn mới** từ thời điểm lưu. Đơn cũ giữ nguyên mức tại thời điểm chốt.

**Q: Tại sao tôi không bấm được "Yêu cầu tất toán"?**
A: 2 lý do: (1) chưa nạp tài khoản ngân hàng (mục 3); (2) số dư khả dụng = 0.

**Q: Hoa hồng nhánh của tôi tính thế nào?**
A: Theo thoả thuận riêng giữa supervisor và Đại Long (thường là % cố định trên tổng doanh số nhánh). Số dư hiển thị ở banner đầu trang là số liệu chính thức từ kế toán Đại Long.

**Q: Đại lý của tôi quên mật khẩu, tôi reset hộ được không?**
A: Không. Đại lý tự reset qua **Quên mật khẩu?** ở trang đăng nhập, email reset gửi đúng email của họ. Supervisor không có quyền đổi mật khẩu hộ.

**Q: Tôi có xem được dashboard cá nhân của đại lý không?**
A: Có — bấm **Xem chi tiết** trên card đại lý. Trang đó hiển thị KPI + lịch sử đơn của đại lý đó (read-only, không sửa được đơn).
