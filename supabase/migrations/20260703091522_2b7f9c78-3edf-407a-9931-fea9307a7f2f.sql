
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('consumer', 'brand_partner', 'admin');
CREATE TYPE public.affiliation_type AS ENUM ('cooperative', 'alumni', 'professional', 'nysc', 'corporate', 'religious', 'union', 'other');
CREATE TYPE public.verification_method AS ENUM ('id_upload', 'email_domain', 'membership_number');
CREATE TYPE public.membership_status AS ENUM ('pending', 'verified', 'rejected', 'expired');
CREATE TYPE public.brand_status AS ENUM ('pending', 'approved', 'suspended', 'rejected');
CREATE TYPE public.deal_status AS ENUM ('draft', 'pending_review', 'published', 'rejected', 'expired');
CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed', 'bogo', 'free_item');
CREATE TYPE public.deal_channel AS ENUM ('online', 'instore', 'both');
CREATE TYPE public.commission_type AS ENUM ('percent', 'flat');
CREATE TYPE public.transaction_status AS ENUM ('redeemed', 'expired', 'cancelled', 'disputed');
CREATE TYPE public.commission_status AS ENUM ('pending', 'invoiced', 'paid');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'void');

-- =========================================================
-- SHARED updated_at TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  state TEXT,
  lga TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- USER ROLES (separate table — required pattern)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- HANDLE NEW USER: auto profile + default consumer role
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consumer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- AFFILIATION GROUPS
-- =========================================================
CREATE TABLE public.affiliation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.affiliation_type NOT NULL,
  description TEXT,
  verification_methods public.verification_method[] NOT NULL DEFAULT '{id_upload}',
  email_domains TEXT[] NOT NULL DEFAULT '{}',
  badge_validity_months INT NOT NULL DEFAULT 12,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliation_groups TO anon, authenticated;
GRANT ALL ON public.affiliation_groups TO service_role;
ALTER TABLE public.affiliation_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_public_read" ON public.affiliation_groups FOR SELECT TO anon, authenticated USING (active = TRUE OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "groups_admin_write" ON public.affiliation_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER affiliation_groups_updated BEFORE UPDATE ON public.affiliation_groups FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- GROUP WHITELIST (admin-uploaded membership numbers)
-- =========================================================
CREATE TABLE public.group_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.affiliation_groups(id) ON DELETE CASCADE,
  membership_number TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, membership_number)
);
GRANT SELECT ON public.group_whitelist TO authenticated;
GRANT ALL ON public.group_whitelist TO service_role;
ALTER TABLE public.group_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whitelist_admin_all" ON public.group_whitelist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- USER MEMBERSHIPS
-- =========================================================
CREATE TABLE public.user_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.affiliation_groups(id) ON DELETE RESTRICT,
  method public.verification_method NOT NULL,
  membership_number TEXT,
  id_document_url TEXT,
  submitted_email TEXT,
  status public.membership_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_memberships TO authenticated;
GRANT ALL ON public.user_memberships TO service_role;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_owner_read" ON public.user_memberships FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "memberships_owner_insert" ON public.user_memberships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memberships_admin_update" ON public.user_memberships FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ON public.user_memberships (user_id);
CREATE INDEX ON public.user_memberships (status);
CREATE TRIGGER user_memberships_updated BEFORE UPDATE ON public.user_memberships FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- BRANDS
-- =========================================================
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  cac_number TEXT,
  category TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status public.brand_status NOT NULL DEFAULT 'pending',
  commission_type public.commission_type NOT NULL DEFAULT 'percent',
  commission_rate NUMERIC(6,3) NOT NULL DEFAULT 10.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.brands TO authenticated;
GRANT SELECT ON public.brands TO anon;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands_public_approved" ON public.brands FOR SELECT TO anon, authenticated
  USING (status = 'approved' OR auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "brands_owner_insert" ON public.brands FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "brands_owner_update" ON public.brands FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- DEALS
-- =========================================================
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT NOT NULL,
  terms TEXT,
  discount_type public.discount_type NOT NULL,
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_group_ids UUID[] NOT NULL DEFAULT '{}',
  channel public.deal_channel NOT NULL DEFAULT 'both',
  redemption_url TEXT,
  image_url TEXT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  per_user_limit INT NOT NULL DEFAULT 1,
  total_cap INT,
  status public.deal_status NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT SELECT ON public.deals TO anon;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals_public_published" ON public.deals FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.owner_user_id = auth.uid())
  );
CREATE POLICY "deals_brand_owner_write" ON public.deals FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.owner_user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.owner_user_id = auth.uid())
  );
CREATE INDEX ON public.deals (status);
CREATE INDEX ON public.deals (brand_id);
CREATE TRIGGER deals_updated BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- SAVED DEALS
-- =========================================================
CREATE TABLE public.saved_deals (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deal_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_deals TO authenticated;
GRANT ALL ON public.saved_deals TO service_role;
ALTER TABLE public.saved_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_deals_owner" ON public.saved_deals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- TRANSACTIONS (redemptions) — commercial data, separated
-- =========================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  group_id UUID REFERENCES public.affiliation_groups(id) ON DELETE SET NULL,
  redemption_code TEXT NOT NULL UNIQUE,
  method public.deal_channel NOT NULL DEFAULT 'online',
  original_price NUMERIC(12,2),
  final_price NUMERIC(12,2),
  discount_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_type public.commission_type NOT NULL,
  commission_rate NUMERIC(6,3) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_status public.commission_status NOT NULL DEFAULT 'pending',
  status public.transaction_status NOT NULL DEFAULT 'redeemed',
  invoice_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_user_own" ON public.transactions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.owner_user_id = auth.uid())
  );
CREATE POLICY "tx_user_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx_admin_update" ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ON public.transactions (user_id);
CREATE INDEX ON public.transactions (brand_id);
CREATE INDEX ON public.transactions (deal_id);
CREATE INDEX ON public.transactions (created_at DESC);

-- =========================================================
-- COMMISSION INVOICES
-- =========================================================
CREATE TABLE public.commission_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  paystack_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.commission_invoices TO authenticated;
GRANT ALL ON public.commission_invoices TO service_role;
ALTER TABLE public.commission_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_brand_owner_read" ON public.commission_invoices FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.owner_user_id = auth.uid())
  );
CREATE POLICY "invoice_admin_write" ON public.commission_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.commission_invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed a few starter affiliation groups
INSERT INTO public.affiliation_groups (name, type, description, verification_methods, email_domains, badge_validity_months) VALUES
  ('NYSC Corps Members', 'nysc', 'National Youth Service Corps serving members', ARRAY['id_upload','membership_number']::public.verification_method[], '{}', 12),
  ('University of Lagos Alumni', 'alumni', 'UNILAG alumni association', ARRAY['id_upload','email_domain']::public.verification_method[], ARRAY['unilag.edu.ng','alumni.unilag.edu.ng'], 24),
  ('University of Ibadan Alumni', 'alumni', 'UI alumni association', ARRAY['id_upload','email_domain']::public.verification_method[], ARRAY['ui.edu.ng'], 24),
  ('ICAN — Chartered Accountants', 'professional', 'Institute of Chartered Accountants of Nigeria', ARRAY['id_upload','membership_number']::public.verification_method[], '{}', 24),
  ('Nigerian Bar Association', 'professional', 'NBA members', ARRAY['id_upload','membership_number']::public.verification_method[], '{}', 24),
  ('Nigerian Medical Association', 'professional', 'NMA members', ARRAY['id_upload','membership_number']::public.verification_method[], '{}', 24);
