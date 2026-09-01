CREATE TYPE public.app_role AS ENUM ('super_admin','owner','admin','accountant','manager','staff','viewer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  currency text NOT NULL DEFAULT 'USD',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.company_id = _company_id);
$$;

CREATE OR REPLACE FUNCTION public.company_role(_user_id uuid, _company_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.memberships m WHERE m.user_id = _user_id AND m.company_id = _company_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_user_id uuid, _company_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = _user_id AND m.company_id = _company_id AND m.role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_company_role(_user_id, _company_id, ARRAY['super_admin','owner','admin']::public.app_role[]);
$$;

CREATE POLICY "companies_select_members" ON public.companies FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_company_member(auth.uid(), id));
CREATE POLICY "companies_insert_own" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "companies_update_admin" ON public.companies FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_company_admin(auth.uid(), id))
  WITH CHECK (owner_id = auth.uid() OR public.is_company_admin(auth.uid(), id));
CREATE POLICY "companies_delete_owner" ON public.companies FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "branches_select_members" ON public.branches FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "branches_write_admin" ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "branches_update_admin" ON public.branches FOR UPDATE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "branches_delete_admin" ON public.branches FOR DELETE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

CREATE POLICY "memberships_select_self_or_company" ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "memberships_insert_admin" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "memberships_update_admin" ON public.memberships FOR UPDATE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "memberships_delete_admin" ON public.memberships FOR DELETE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));

-- auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- owner becomes member automatically
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.memberships (user_id, company_id, role)
  VALUES (NEW.owner_id, NEW.id, 'owner')
  ON CONFLICT (user_id, company_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_company_created AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();