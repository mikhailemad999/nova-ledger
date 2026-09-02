
-- ENUMS
CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','income','expense');
CREATE TYPE public.partner_kind AS ENUM ('customer','supplier');
CREATE TYPE public.journal_status AS ENUM ('draft','posted','void');

-- PARTNERS
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind public.partner_kind NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  tax_id text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY partners_select_members ON public.partners FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY partners_insert_staff ON public.partners FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY partners_update_staff ON public.partners FOR UPDATE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]))
  WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY partners_delete_admin ON public.partners FOR DELETE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));
CREATE INDEX partners_company_kind_idx ON public.partners(company_id, kind);
CREATE TRIGGER partners_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ACCOUNTS
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL,
  parent_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_select_members ON public.accounts FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY accounts_insert_acct ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]));
CREATE POLICY accounts_update_acct ON public.accounts FOR UPDATE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]));
CREATE POLICY accounts_delete_admin ON public.accounts FOR DELETE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- JOURNAL ENTRIES
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  entry_no text NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  memo text,
  reference text,
  status public.journal_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, entry_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY je_select_members ON public.journal_entries FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY je_insert_acct ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]));
CREATE POLICY je_update_acct ON public.journal_entries FOR UPDATE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]));
CREATE POLICY je_delete_admin ON public.journal_entries FOR DELETE TO authenticated
  USING (public.is_company_admin(auth.uid(), company_id));
CREATE INDEX je_company_date_idx ON public.journal_entries(company_id, entry_date DESC);
CREATE TRIGGER je_updated_at BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- JOURNAL LINES
CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  description text,
  debit numeric(18,2) NOT NULL DEFAULT 0,
  credit numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY jl_select_members ON public.journal_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY jl_insert_acct ON public.journal_lines FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]));
CREATE POLICY jl_update_acct ON public.journal_lines FOR UPDATE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]))
  WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]));
CREATE POLICY jl_delete_acct ON public.journal_lines FOR DELETE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant']::public.app_role[]));
CREATE INDEX jl_entry_idx ON public.journal_lines(entry_id);
CREATE INDEX jl_account_idx ON public.journal_lines(account_id);

-- LINE VALIDATION: no negative amounts, not both sides
CREATE OR REPLACE FUNCTION public.validate_journal_line()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.debit < 0 OR NEW.credit < 0 THEN
    RAISE EXCEPTION 'Journal line amounts cannot be negative';
  END IF;
  IF NEW.debit > 0 AND NEW.credit > 0 THEN
    RAISE EXCEPTION 'A journal line cannot have both a debit and a credit';
  END IF;
  IF NEW.debit = 0 AND NEW.credit = 0 THEN
    RAISE EXCEPTION 'A journal line must have a debit or a credit amount';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER journal_lines_validate BEFORE INSERT OR UPDATE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.validate_journal_line();

-- POSTING: balanced check
CREATE OR REPLACE FUNCTION public.check_entry_balanced()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  total_debit numeric(18,2);
  total_credit numeric(18,2);
BEGIN
  IF NEW.status = 'posted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'posted') THEN
    SELECT COALESCE(sum(debit),0), COALESCE(sum(credit),0)
      INTO total_debit, total_credit
      FROM public.journal_lines WHERE entry_id = NEW.id;
    IF total_debit = 0 AND total_credit = 0 THEN
      RAISE EXCEPTION 'Cannot post an entry with no lines';
    END IF;
    IF total_debit <> total_credit THEN
      RAISE EXCEPTION 'Entry is out of balance: debits % vs credits %', total_debit, total_credit;
    END IF;
    NEW.posted_at := COALESCE(NEW.posted_at, now());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER journal_entries_balanced BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_entry_balanced();

-- SEED STARTER DATA FOR A COMPANY
CREATE OR REPLACE FUNCTION public.seed_company_accounting(_company_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hq uuid; downtown uuid;
  a_cash uuid; a_bank uuid; a_ar uuid; a_inventory uuid; a_equipment uuid;
  a_ap uuid; a_vat uuid; a_loan uuid; a_capital uuid; a_retained uuid;
  a_sales uuid; a_services uuid; a_cogs uuid; a_rent uuid; a_salaries uuid; a_utilities uuid; a_marketing uuid;
  c1 uuid; c2 uuid; c3 uuid; s1 uuid; s2 uuid;
  e uuid; n int := 0;
  d date := current_date;
BEGIN
  IF EXISTS (SELECT 1 FROM public.accounts WHERE company_id = _company_id) THEN RETURN; END IF;

  INSERT INTO public.branches (company_id, name, code, address)
    VALUES (_company_id, 'Head Office', 'HQ', '1 Market Street') RETURNING id INTO hq;
  INSERT INTO public.branches (company_id, name, code, address)
    VALUES (_company_id, 'Downtown Branch', 'DTN', '42 River Avenue') RETURNING id INTO downtown;

  INSERT INTO public.accounts (company_id, code, name, type) VALUES
    (_company_id,'1000','Cash on Hand','asset') RETURNING id INTO a_cash;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'1010','Bank Account','asset') RETURNING id INTO a_bank;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'1100','Accounts Receivable','asset') RETURNING id INTO a_ar;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'1200','Inventory','asset') RETURNING id INTO a_inventory;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'1500','Equipment','asset') RETURNING id INTO a_equipment;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'2000','Accounts Payable','liability') RETURNING id INTO a_ap;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'2100','VAT Payable','liability') RETURNING id INTO a_vat;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'2500','Bank Loan','liability') RETURNING id INTO a_loan;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'3000','Share Capital','equity') RETURNING id INTO a_capital;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'3100','Retained Earnings','equity') RETURNING id INTO a_retained;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'4000','Product Sales','income') RETURNING id INTO a_sales;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'4100','Service Revenue','income') RETURNING id INTO a_services;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'5000','Cost of Goods Sold','expense') RETURNING id INTO a_cogs;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'6000','Rent Expense','expense') RETURNING id INTO a_rent;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'6100','Salaries Expense','expense') RETURNING id INTO a_salaries;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'6200','Utilities Expense','expense') RETURNING id INTO a_utilities;
  INSERT INTO public.accounts (company_id, code, name, type) VALUES (_company_id,'6300','Marketing Expense','expense') RETURNING id INTO a_marketing;

  INSERT INTO public.partners (company_id, kind, name, email, phone, tax_id)
    VALUES (_company_id,'customer','Northwind Retail','ap@northwind.example','+1 202 555 0111','TX-4410') RETURNING id INTO c1;
  INSERT INTO public.partners (company_id, kind, name, email, phone, tax_id)
    VALUES (_company_id,'customer','Blue Harbor Logistics','finance@blueharbor.example','+1 202 555 0142','TX-8823') RETURNING id INTO c2;
  INSERT INTO public.partners (company_id, kind, name, email, phone, tax_id)
    VALUES (_company_id,'customer','Cedar Consulting','billing@cedar.example','+1 202 555 0177','TX-1290') RETURNING id INTO c3;
  INSERT INTO public.partners (company_id, kind, name, email, phone, tax_id)
    VALUES (_company_id,'supplier','Atlas Components','sales@atlas.example','+1 202 555 0190','TX-5521') RETURNING id INTO s1;
  INSERT INTO public.partners (company_id, kind, name, email, phone, tax_id)
    VALUES (_company_id,'supplier','Vertex Office Supplies','orders@vertex.example','+1 202 555 0166','TX-7734') RETURNING id INTO s2;

  -- 1. Opening capital
  INSERT INTO public.journal_entries (company_id, branch_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, hq, 'JE-0001', d - 120, 'Opening share capital', 'OPEN-1', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, description, debit, credit) VALUES
    (e,_company_id,a_bank,'Capital injection',250000,0),
    (e,_company_id,a_capital,'Capital injection',0,250000);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 2. Equipment purchase on credit
  INSERT INTO public.journal_entries (company_id, branch_id, partner_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, hq, s1, 'JE-0002', d - 95, 'Purchase of workshop equipment', 'BILL-1001', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, partner_id, description, debit, credit) VALUES
    (e,_company_id,a_equipment,s1,'Workshop equipment',48000,0),
    (e,_company_id,a_ap,s1,'Atlas Components bill',0,48000);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 3. Inventory purchase
  INSERT INTO public.journal_entries (company_id, branch_id, partner_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, downtown, s2, 'JE-0003', d - 70, 'Inventory restock', 'BILL-1002', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, partner_id, description, debit, credit) VALUES
    (e,_company_id,a_inventory,s2,'Stock purchase',62000,0),
    (e,_company_id,a_ap,s2,'Vertex bill',0,62000);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 4. Product sale on credit
  INSERT INTO public.journal_entries (company_id, branch_id, partner_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, downtown, c1, 'JE-0004', d - 55, 'Invoice to Northwind Retail', 'INV-2001', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, partner_id, description, debit, credit) VALUES
    (e,_company_id,a_ar,c1,'Invoice INV-2001',96600,0),
    (e,_company_id,a_sales,c1,'Product sales',0,84000),
    (e,_company_id,a_vat,c1,'VAT 15%',0,12600);
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, description, debit, credit) VALUES
    (e,_company_id,a_cogs,'Cost of goods sold',51000,0),
    (e,_company_id,a_inventory,'Inventory relief',0,51000);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 5. Customer payment
  INSERT INTO public.journal_entries (company_id, branch_id, partner_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, downtown, c1, 'JE-0005', d - 40, 'Payment received from Northwind Retail', 'RCPT-3001', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, partner_id, description, debit, credit) VALUES
    (e,_company_id,a_bank,c1,'Bank receipt',70000,0),
    (e,_company_id,a_ar,c1,'Settle INV-2001',0,70000);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 6. Services invoice
  INSERT INTO public.journal_entries (company_id, branch_id, partner_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, hq, c2, 'JE-0006', d - 30, 'Consulting services to Blue Harbor', 'INV-2002', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, partner_id, description, debit, credit) VALUES
    (e,_company_id,a_ar,c2,'Invoice INV-2002',43700,0),
    (e,_company_id,a_services,c2,'Consulting revenue',0,38000),
    (e,_company_id,a_vat,c2,'VAT 15%',0,5700);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 7. Operating expenses
  INSERT INTO public.journal_entries (company_id, branch_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, hq, 'JE-0007', d - 20, 'Monthly operating expenses', 'EXP-4001', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, description, debit, credit) VALUES
    (e,_company_id,a_rent,'Office rent',12000,0),
    (e,_company_id,a_salaries,'Payroll',34000,0),
    (e,_company_id,a_utilities,'Electricity and internet',3200,0),
    (e,_company_id,a_marketing,'Digital campaigns',5400,0),
    (e,_company_id,a_bank,'Paid from bank',0,54600);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 8. Supplier payment
  INSERT INTO public.journal_entries (company_id, branch_id, partner_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, hq, s1, 'JE-0008', d - 12, 'Payment to Atlas Components', 'PAY-5001', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, partner_id, description, debit, credit) VALUES
    (e,_company_id,a_ap,s1,'Settle BILL-1001',30000,0),
    (e,_company_id,a_bank,s1,'Bank payment',0,30000);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 9. Cash sale
  INSERT INTO public.journal_entries (company_id, branch_id, partner_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, downtown, c3, 'JE-0009', d - 5, 'Cash sale to Cedar Consulting', 'INV-2003', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, partner_id, description, debit, credit) VALUES
    (e,_company_id,a_cash,c3,'Cash received',20700,0),
    (e,_company_id,a_sales,c3,'Product sales',0,18000),
    (e,_company_id,a_vat,c3,'VAT 15%',0,2700);
  UPDATE public.journal_entries SET status='posted' WHERE id=e;

  -- 10. Draft accrual
  INSERT INTO public.journal_entries (company_id, branch_id, entry_no, entry_date, memo, reference, status, created_by)
    VALUES (_company_id, hq, 'JE-0010', d - 1, 'Accrued utilities (draft)', 'ACC-6001', 'draft', _user_id) RETURNING id INTO e;
  INSERT INTO public.journal_lines (entry_id, company_id, account_id, description, debit, credit) VALUES
    (e,_company_id,a_utilities,'Accrued electricity',1800,0),
    (e,_company_id,a_ap,'Accrual',0,1800);
END;
$$;
REVOKE ALL ON FUNCTION public.seed_company_accounting(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- BOOTSTRAP A STARTER WORKSPACE FOR NEW USERS
CREATE OR REPLACE FUNCTION public.bootstrap_user_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.companies (name, legal_name, currency, owner_id)
    VALUES ('Acme Holding', 'Acme Holding Ltd.', 'USD', NEW.id)
    RETURNING id INTO cid;
  PERFORM public.seed_company_accounting(cid, NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_user_workspace() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_bootstrap ON auth.users;
CREATE TRIGGER on_auth_user_bootstrap
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_user_workspace();
