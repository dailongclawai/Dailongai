-- Boss chốt 28/07/2026: CRM chỉ mở cho staff và admin.
-- Đại lý/supervisor không đọc không ghi được bản ghi CRM nào nữa.
-- Giữ nguyên chốt chặn bản ghi cha của Plan 1, chỉ THÊM điều kiện vai trò.

CREATE OR REPLACE FUNCTION public.crm_role_allowed()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.current_role() IN ('staff', 'admin');
$$;

REVOKE EXECUTE ON FUNCTION public.crm_role_allowed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_role_allowed() FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_role_allowed() TO authenticated;

-- ── crm_accounts ──
DROP POLICY IF EXISTS crm_accounts_select ON public.crm_accounts;
CREATE POLICY crm_accounts_select ON public.crm_accounts
    FOR SELECT TO authenticated
    USING (
        public.crm_role_allowed()
        AND (
            owner_id = auth.uid()
            OR public.current_role() = 'admin'
            -- staff đã bắn khách đi vẫn theo dõi được để nhận thưởng
            OR EXISTS (
                SELECT 1 FROM public.crm_handovers h
                WHERE h.account_id = public.crm_accounts.id
                  AND h.from_staff_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS crm_accounts_insert ON public.crm_accounts;
CREATE POLICY crm_accounts_insert ON public.crm_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
    );

DROP POLICY IF EXISTS crm_accounts_update ON public.crm_accounts;
CREATE POLICY crm_accounts_update ON public.crm_accounts
    FOR UPDATE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'))
    WITH CHECK (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));

DROP POLICY IF EXISTS crm_accounts_delete ON public.crm_accounts;
CREATE POLICY crm_accounts_delete ON public.crm_accounts
    FOR DELETE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));

-- ── crm_contacts ──
DROP POLICY IF EXISTS crm_contacts_select ON public.crm_contacts;
CREATE POLICY crm_contacts_select ON public.crm_contacts
    FOR SELECT TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
    );

DROP POLICY IF EXISTS crm_contacts_insert ON public.crm_contacts;
CREATE POLICY crm_contacts_insert ON public.crm_contacts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS crm_contacts_update ON public.crm_contacts;
CREATE POLICY crm_contacts_update ON public.crm_contacts
    FOR UPDATE TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    )
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    );

DROP POLICY IF EXISTS crm_contacts_delete ON public.crm_contacts;
CREATE POLICY crm_contacts_delete ON public.crm_contacts
    FOR DELETE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));

-- ── crm_opportunities ──
DROP POLICY IF EXISTS crm_opps_select ON public.crm_opportunities;
CREATE POLICY crm_opps_select ON public.crm_opportunities
    FOR SELECT TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
    );

DROP POLICY IF EXISTS crm_opps_insert ON public.crm_opportunities;
CREATE POLICY crm_opps_insert ON public.crm_opportunities
    FOR INSERT TO authenticated
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    );

DROP POLICY IF EXISTS crm_opps_update ON public.crm_opportunities;
CREATE POLICY crm_opps_update ON public.crm_opportunities
    FOR UPDATE TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
    )
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
        AND EXISTS (
            SELECT 1 FROM public.crm_accounts a
            WHERE a.id = account_id
              AND (a.owner_id = auth.uid() OR public.current_role() = 'admin')
        )
        AND (contact_id IS NULL OR EXISTS (
            SELECT 1 FROM public.crm_contacts c
            WHERE c.id = contact_id
              AND (c.owner_id = auth.uid() OR public.current_role() = 'admin')
        ))
    );

DROP POLICY IF EXISTS crm_opps_delete ON public.crm_opportunities;
CREATE POLICY crm_opps_delete ON public.crm_opportunities
    FOR DELETE TO authenticated
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));

-- ── crm_activities ──
DROP POLICY IF EXISTS crm_activities_select ON public.crm_activities;
CREATE POLICY crm_activities_select ON public.crm_activities
    FOR SELECT TO authenticated
    USING (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
    );

DROP POLICY IF EXISTS crm_activities_insert ON public.crm_activities;
CREATE POLICY crm_activities_insert ON public.crm_activities
    FOR INSERT TO authenticated
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
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
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'))
    WITH CHECK (
        public.crm_role_allowed()
        AND (owner_id = auth.uid() OR public.current_role() = 'admin')
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
    USING (public.crm_role_allowed() AND (owner_id = auth.uid() OR public.current_role() = 'admin'));
