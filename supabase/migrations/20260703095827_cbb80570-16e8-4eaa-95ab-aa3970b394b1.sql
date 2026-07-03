
-- Drop the SECURITY-DEFINER-style view and use column-level privileges instead.
DROP VIEW IF EXISTS public.brand_directory;

-- Restore public SELECT policy but scoped: anonymous can only read approved brands;
-- owner/admin can still read everything.
DROP POLICY IF EXISTS brands_owner_admin_select ON public.brands;
CREATE POLICY brands_public_approved ON public.brands
  FOR SELECT TO anon, authenticated
  USING (
    status = 'approved'
    OR auth.uid() = owner_user_id
    OR private.has_role(auth.uid(), 'admin')
  );

-- Column-level: anonymous visitors cannot see contact_email, contact_phone,
-- cac_number, owner_user_id, or commission fields.
REVOKE SELECT ON public.brands FROM anon;
GRANT SELECT (
  id, name, slug, category, description, logo_url, website, status, created_at, updated_at
) ON public.brands TO anon;
