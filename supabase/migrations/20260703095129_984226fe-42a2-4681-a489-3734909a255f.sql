
-- Storage policies for membership-docs (private)
CREATE POLICY "membership_docs_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'membership-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "membership_docs_owner_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'membership-docs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "membership_docs_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'membership-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Auto-verify trigger: on insert of user_memberships, check email domain / whitelist
CREATE OR REPLACE FUNCTION public.tg_auto_verify_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_email TEXT;
  v_domain TEXT;
  v_matched BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_group FROM public.affiliation_groups WHERE id = NEW.group_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Email domain match
  IF NEW.method = 'email_domain' AND array_length(v_group.email_domains, 1) > 0 THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    IF v_email IS NOT NULL THEN
      v_domain := lower(split_part(v_email, '@', 2));
      IF v_domain = ANY (SELECT lower(unnest(v_group.email_domains))) THEN
        v_matched := TRUE;
      END IF;
    END IF;
  END IF;

  -- Whitelist match
  IF NOT v_matched AND NEW.method = 'membership_number' AND NEW.membership_number IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.group_whitelist
      WHERE group_id = NEW.group_id
        AND lower(membership_number) = lower(NEW.membership_number)
    ) THEN
      v_matched := TRUE;
    END IF;
  END IF;

  IF v_matched THEN
    NEW.status := 'verified';
    NEW.verified_at := now();
    NEW.expires_at := now() + (v_group.badge_validity_months || ' months')::interval;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_verify_membership ON public.user_memberships;
CREATE TRIGGER auto_verify_membership
  BEFORE INSERT ON public.user_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_verify_membership();

-- On update to verified by admin, stamp expiry
CREATE OR REPLACE FUNCTION public.tg_stamp_membership_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_months INT;
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified') THEN
    SELECT badge_validity_months INTO v_months FROM public.affiliation_groups WHERE id = NEW.group_id;
    IF v_months IS NOT NULL THEN
      NEW.verified_at := COALESCE(NEW.verified_at, now());
      NEW.expires_at := COALESCE(NEW.expires_at, now() + (v_months || ' months')::interval);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_membership_expiry ON public.user_memberships;
CREATE TRIGGER stamp_membership_expiry
  BEFORE UPDATE ON public.user_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_stamp_membership_expiry();
