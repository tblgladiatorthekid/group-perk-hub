
-- =========================================================
-- 1. Move public.has_role → private.has_role
-- =========================================================
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate all policies to reference private.has_role
-- affiliation_groups
DROP POLICY IF EXISTS groups_admin_write ON public.affiliation_groups;
CREATE POLICY groups_admin_write ON public.affiliation_groups
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS groups_public_read ON public.affiliation_groups;
CREATE POLICY groups_public_read ON public.affiliation_groups
  FOR SELECT TO anon, authenticated
  USING (active = true OR private.has_role(auth.uid(), 'admin'));

-- brands: owner/admin update; new owner+admin-only SELECT; drop old public SELECT
DROP POLICY IF EXISTS brands_owner_update ON public.brands;
CREATE POLICY brands_owner_update ON public.brands
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_user_id OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS brands_public_approved ON public.brands;
CREATE POLICY brands_owner_admin_select ON public.brands
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR private.has_role(auth.uid(), 'admin'));

-- commission_invoices
DROP POLICY IF EXISTS invoice_admin_write ON public.commission_invoices;
CREATE POLICY invoice_admin_write ON public.commission_invoices
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS invoice_brand_owner_read ON public.commission_invoices;
CREATE POLICY invoice_brand_owner_read ON public.commission_invoices
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = commission_invoices.brand_id AND b.owner_user_id = auth.uid()
    )
  );

-- deals
DROP POLICY IF EXISTS deals_brand_owner_write ON public.deals;
CREATE POLICY deals_brand_owner_write ON public.deals
  FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = deals.brand_id AND b.owner_user_id = auth.uid())
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = deals.brand_id AND b.owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS deals_public_published ON public.deals;
CREATE POLICY deals_public_published ON public.deals
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    OR private.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = deals.brand_id AND b.owner_user_id = auth.uid())
  );

-- group_whitelist
DROP POLICY IF EXISTS whitelist_admin_all ON public.group_whitelist;
CREATE POLICY whitelist_admin_all ON public.group_whitelist
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- transactions
DROP POLICY IF EXISTS tx_admin_update ON public.transactions;
CREATE POLICY tx_admin_update ON public.transactions
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS tx_user_own ON public.transactions;
CREATE POLICY tx_user_own ON public.transactions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR private.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = transactions.brand_id AND b.owner_user_id = auth.uid())
  );

-- user_memberships
DROP POLICY IF EXISTS memberships_admin_update ON public.user_memberships;
CREATE POLICY memberships_admin_update ON public.user_memberships
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS memberships_owner_read ON public.user_memberships;
CREATE POLICY memberships_owner_read ON public.user_memberships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

-- user_roles
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- storage.objects membership-docs read
DROP POLICY IF EXISTS membership_docs_owner_read ON storage.objects;
CREATE POLICY membership_docs_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'membership-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_role(auth.uid(), 'admin')
    )
  );

-- Now drop the public has_role since nothing references it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- =========================================================
-- 2. Brand contact info: hide from public listing
--    Public listing now goes through a view with only safe columns.
-- =========================================================
CREATE OR REPLACE VIEW public.brand_directory
WITH (security_invoker = false) AS
SELECT
  id, name, slug, category, description, logo_url, website, created_at
FROM public.brands
WHERE status = 'approved';

GRANT SELECT ON public.brand_directory TO anon, authenticated;

-- =========================================================
-- 3. handle_new_user: honor intended_role metadata for brand sign-ups
--    (replaces the browser-side insert into user_roles)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intended TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'consumer')
  ON CONFLICT (user_id, role) DO NOTHING;

  v_intended := NEW.raw_user_meta_data->>'intended_role';
  IF v_intended = 'brand' OR v_intended = 'brand_partner' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'brand_partner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
