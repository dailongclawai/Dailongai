-- CRM hoạt động: nhiệm vụ / cuộc gọi / lịch hẹn. Luôn gắn với khách hàng hoặc cơ hội.

CREATE TABLE IF NOT EXISTS public.crm_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('task', 'call', 'meeting')),
    subject text NOT NULL,
    notes text,
    due_at timestamptz,
    done_at timestamptz,
    outcome text,
    account_id uuid REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
    opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
    owner_id uuid NOT NULL REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crm_activities_needs_parent
        CHECK (account_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_owner_due
    ON public.crm_activities(owner_id, done_at, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_activities_account ON public.crm_activities(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opp ON public.crm_activities(opportunity_id);

DROP TRIGGER IF EXISTS crm_activities_set_updated_at ON public.crm_activities;
CREATE TRIGGER crm_activities_set_updated_at
BEFORE UPDATE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_activities_select ON public.crm_activities;
CREATE POLICY crm_activities_select ON public.crm_activities
    FOR SELECT TO authenticated
    USING (public.crm_owner_visible(owner_id));

-- Như crm_contacts/crm_opportunities: phải kiểm CẢ bản ghi cha vì khoá ngoại
-- không chịu RLS. Hoạt động gắn được vào khách VÀ/HOẶC cơ hội VÀ/HOẶC liên hệ,
-- nên kiểm từng cột khi nó khác NULL. Dùng phép thử SỞ HỮU (owner_id = auth.uid()
-- OR admin), không phải crm_owner_visible: supervisor được ĐỌC bản ghi của
-- nhánh nhưng không được ghi lên đó. contact_id được kiểm thêm ở đây (không có
-- trong bản thảo gốc của Task 6) để khớp quy ước đã áp dụng cho crm_contacts và
-- crm_opportunities: mọi khoá ngoại trỏ tới bảng có RLS theo owner đều phải
-- được xác minh, không chỉ account_id/opportunity_id.
DROP POLICY IF EXISTS crm_activities_insert ON public.crm_activities;
CREATE POLICY crm_activities_insert ON public.crm_activities
    FOR INSERT TO authenticated
    WITH CHECK (
        (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND (account_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (opportunity_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_opportunities o
            WHERE o.id = opportunity_id
              AND (o.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    );

DROP POLICY IF EXISTS crm_activities_update ON public.crm_activities;
CREATE POLICY crm_activities_update ON public.crm_activities
    FOR UPDATE TO authenticated
    USING (
        (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND (account_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (opportunity_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_opportunities o
            WHERE o.id = opportunity_id
              AND (o.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    )
    WITH CHECK (
        (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND (account_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (opportunity_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_opportunities o
            WHERE o.id = opportunity_id
              AND (o.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    );

DROP POLICY IF EXISTS crm_activities_delete ON public.crm_activities;
CREATE POLICY crm_activities_delete ON public.crm_activities
    FOR DELETE TO authenticated
    USING (owner_id = auth.uid() OR public.current_role() = 'admin');
