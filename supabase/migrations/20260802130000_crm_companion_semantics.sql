-- Boss chốt 02/08/2026: chế độ bán KHÔNG có dùng thử. Cột trial_days từ nay mang
-- nghĩa "Chương trình đồng hành hoàn tiền sau mua" theo phiếu cam kết CS-HT30:
-- khách mua đứt, dùng đúng 30 ngày (54/60 buổi, báo cáo nhóm Zalo), đối chiếu
-- Phiếu A/B tại cơ sở y tế; cả ba chỉ số không giảm thì hoàn 100% + thu hồi máy;
-- được gia hạn Phiếu C tới 60 ngày. Cơ chế treo hoa hồng (pending tới eligible_at)
-- giữ nguyên — trong thời gian chương trình vẫn có thể hoàn tiền.

comment on column public.crm_opportunities.trial_days is
'Chương trình đồng hành hoàn tiền sau mua theo phiếu CS-HT30 (30 ngày, gia hạn 60 — UI chỉ cho hai mốc này). KHÔNG phải dùng thử: khách mua đứt; hoa hồng treo (pending) tới khi hết chương trình vì có thể hoàn 100%.';
