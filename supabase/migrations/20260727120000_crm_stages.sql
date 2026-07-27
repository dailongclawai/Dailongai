-- CRM pipeline stages. Hai pipeline: b2c_device (bán máy cho khách cuối),
-- b2b_dealer (tuyển và chăm đại lý). Mẫu giai đoạn học từ AMIS CRM.

CREATE TABLE IF NOT EXISTS public.crm_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline text NOT NULL CHECK (pipeline IN ('b2c_device', 'b2b_dealer')),
    name text NOT NULL,
    probability smallint NOT NULL CHECK (probability BETWEEN 0 AND 100),
    forecast text NOT NULL CHECK (forecast IN ('open', 'won', 'lost')),
    sort_order smallint NOT NULL,
    active boolean NOT NULL DEFAULT true,
    UNIQUE (pipeline, sort_order),
    UNIQUE (pipeline, name)
);

ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;

-- Reads intentionally include inactive stages so admins can reactivate them;
-- the client filters `active` itself.
DROP POLICY IF EXISTS crm_stages_select_all ON public.crm_stages;
CREATE POLICY crm_stages_select_all ON public.crm_stages
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS crm_stages_admin_write ON public.crm_stages;
CREATE POLICY crm_stages_admin_write ON public.crm_stages
    FOR ALL TO authenticated
    USING (public.current_role() = 'admin')
    WITH CHECK (public.current_role() = 'admin');

INSERT INTO public.crm_stages (pipeline, name, probability, forecast, sort_order) VALUES
    ('b2c_device', 'Mới tiếp nhận',      10,  'open', 1),
    ('b2c_device', 'Đang quan tâm',      30,  'open', 2),
    ('b2c_device', 'Đã trải nghiệm máy', 50,  'open', 3),
    ('b2c_device', 'Đàm phán giá',       70,  'open', 4),
    ('b2c_device', 'Chốt đơn',          100,  'won',  5),
    ('b2c_device', 'Không mua',           0,  'lost', 6),
    ('b2b_dealer', 'Mới tiếp cận',       10,  'open', 1),
    ('b2b_dealer', 'Đã gửi chính sách',  30,  'open', 2),
    ('b2b_dealer', 'Đàm phán hợp tác',   50,  'open', 3),
    ('b2b_dealer', 'Chờ đơn đầu tiên',   80,  'open', 4),
    ('b2b_dealer', 'Thành đại lý',      100,  'won',  5),
    ('b2b_dealer', 'Từ chối hợp tác',     0,  'lost', 6)
ON CONFLICT (pipeline, sort_order) DO NOTHING;
