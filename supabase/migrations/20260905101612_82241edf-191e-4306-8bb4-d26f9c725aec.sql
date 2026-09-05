-- ENUMS
CREATE TYPE public.trade_doc_kind AS ENUM ('quotation','invoice','purchase_order');
CREATE TYPE public.trade_doc_status AS ENUM ('draft','confirmed','posted','cancelled');
CREATE TYPE public.stock_move_kind AS ENUM ('in','out','adjustment');

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  sale_price numeric(18,2) NOT NULL DEFAULT 0,
  cost_price numeric(18,2) NOT NULL DEFAULT 0,
  track_inventory boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, sku)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select_members ON public.products FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY products_insert_staff ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY products_update_staff ON public.products FOR UPDATE TO authenticated USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[])) WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY products_delete_admin ON public.products FOR DELETE TO authenticated USING (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WAREHOUSES
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY warehouses_select_members ON public.warehouses FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY warehouses_insert_staff ON public.warehouses FOR INSERT TO authenticated WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY warehouses_update_staff ON public.warehouses FOR UPDATE TO authenticated USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[])) WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY warehouses_delete_admin ON public.warehouses FOR DELETE TO authenticated USING (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STOCK MOVES
CREATE TABLE public.stock_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  kind public.stock_move_kind NOT NULL,
  quantity numeric(18,3) NOT NULL,
  unit_cost numeric(18,2) NOT NULL DEFAULT 0,
  reference text,
  note text,
  moved_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_moves_company_idx ON public.stock_moves (company_id, moved_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_moves TO authenticated;
GRANT ALL ON public.stock_moves TO service_role;
ALTER TABLE public.stock_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY sm_select_members ON public.stock_moves FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY sm_insert_staff ON public.stock_moves FOR INSERT TO authenticated WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY sm_update_staff ON public.stock_moves FOR UPDATE TO authenticated USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[])) WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY sm_delete_admin ON public.stock_moves FOR DELETE TO authenticated USING (public.is_company_admin(auth.uid(), company_id));

-- TRADE DOCUMENTS
CREATE TABLE public.trade_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  kind public.trade_doc_kind NOT NULL,
  doc_no text NOT NULL,
  doc_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status public.trade_doc_status NOT NULL DEFAULT 'draft',
  notes text,
  subtotal numeric(18,2) NOT NULL DEFAULT 0,
  tax_total numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, kind, doc_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_documents TO authenticated;
GRANT ALL ON public.trade_documents TO service_role;
ALTER TABLE public.trade_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY td_select_members ON public.trade_documents FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY td_insert_staff ON public.trade_documents FOR INSERT TO authenticated WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY td_update_staff ON public.trade_documents FOR UPDATE TO authenticated USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[])) WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY td_delete_admin ON public.trade_documents FOR DELETE TO authenticated USING (public.is_company_admin(auth.uid(), company_id));
CREATE TRIGGER trade_documents_updated_at BEFORE UPDATE ON public.trade_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRADE DOCUMENT LINES
CREATE TABLE public.trade_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.trade_documents(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text,
  quantity numeric(18,3) NOT NULL DEFAULT 1,
  unit_price numeric(18,2) NOT NULL DEFAULT 0,
  tax_rate numeric(6,2) NOT NULL DEFAULT 0,
  line_total numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tdl_document_idx ON public.trade_document_lines (document_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_document_lines TO authenticated;
GRANT ALL ON public.trade_document_lines TO service_role;
ALTER TABLE public.trade_document_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY tdl_select_members ON public.trade_document_lines FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY tdl_insert_staff ON public.trade_document_lines FOR INSERT TO authenticated WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY tdl_update_staff ON public.trade_document_lines FOR UPDATE TO authenticated USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[])) WITH CHECK (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));
CREATE POLICY tdl_delete_staff ON public.trade_document_lines FOR DELETE TO authenticated USING (public.has_company_role(auth.uid(), company_id, ARRAY['super_admin','owner','admin','accountant','manager','staff']::public.app_role[]));

-- SEED FUNCTION FOR TRADE + INVENTORY
CREATE OR REPLACE FUNCTION public.seed_company_trade(_company_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hq uuid; dtn uuid;
  wh_main uuid; wh_dtn uuid;
  p_widget uuid; p_gadget uuid; p_service uuid;
  cust uuid; supp uuid;
  je_inv uuid; je_po uuid;
  doc uuid;
  d date := current_date;
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE company_id = _company_id) THEN RETURN; END IF;

  SELECT id INTO hq FROM public.branches WHERE company_id = _company_id AND code = 'HQ' LIMIT 1;
  SELECT id INTO dtn FROM public.branches WHERE company_id = _company_id AND code = 'DTN' LIMIT 1;
  SELECT id INTO cust FROM public.partners WHERE company_id = _company_id AND name = 'Northwind Retail' LIMIT 1;
  SELECT id INTO supp FROM public.partners WHERE company_id = _company_id AND name = 'Vertex Office Supplies' LIMIT 1;
  SELECT id INTO je_inv FROM public.journal_entries WHERE company_id = _company_id AND entry_no = 'JE-0004' LIMIT 1;
  SELECT id INTO je_po FROM public.journal_entries WHERE company_id = _company_id AND entry_no = 'JE-0003' LIMIT 1;

  INSERT INTO public.warehouses (company_id, branch_id, name, code, address)
    VALUES (_company_id, hq, 'Main Warehouse', 'WH-MAIN', '1 Market Street') RETURNING id INTO wh_main;
  INSERT INTO public.warehouses (company_id, branch_id, name, code, address)
    VALUES (_company_id, dtn, 'Downtown Store', 'WH-DTN', '42 River Avenue') RETURNING id INTO wh_dtn;

  INSERT INTO public.products (company_id, sku, name, unit, sale_price, cost_price, track_inventory)
    VALUES (_company_id, 'SKU-1001', 'Widget Pro', 'unit', 600, 300, true) RETURNING id INTO p_widget;
  INSERT INTO public.products (company_id, sku, name, unit, sale_price, cost_price, track_inventory)
    VALUES (_company_id, 'SKU-1002', 'Gadget Mini', 'unit', 250, 200, true) RETURNING id INTO p_gadget;
  INSERT INTO public.products (company_id, sku, name, unit, sale_price, cost_price, track_inventory)
    VALUES (_company_id, 'SVC-2001', 'Consulting Hour', 'hour', 190, 0, false) RETURNING id INTO p_service;

  -- Inbound stock matching JE-0003 inventory purchase of 62,000
  INSERT INTO public.stock_moves (company_id, warehouse_id, product_id, kind, quantity, unit_cost, reference, note, moved_at, created_by) VALUES
    (_company_id, wh_main, p_widget, 'in', 100, 300, 'BILL-1002', 'Inventory restock', d - 70, _user_id),
    (_company_id, wh_main, p_gadget, 'in', 160, 200, 'BILL-1002', 'Inventory restock', d - 70, _user_id);
  -- Outbound stock matching JE-0004 cost of goods sold of 51,000
  INSERT INTO public.stock_moves (company_id, warehouse_id, product_id, kind, quantity, unit_cost, reference, note, moved_at, created_by) VALUES
    (_company_id, wh_main, p_widget, 'out', 90, 300, 'INV-2001', 'Shipped to Northwind Retail', d - 55, _user_id),
    (_company_id, wh_main, p_gadget, 'out', 120, 200, 'INV-2001', 'Shipped to Northwind Retail', d - 55, _user_id);

  -- Posted customer invoice tied to JE-0004 (84,000 net + 12,600 VAT)
  INSERT INTO public.trade_documents (company_id, branch_id, partner_id, kind, doc_no, doc_date, due_date, status, notes, subtotal, tax_total, total, journal_entry_id, created_by)
    VALUES (_company_id, dtn, cust, 'invoice', 'INV-2001', d - 55, d - 25, 'posted', 'Goods delivered from Main Warehouse', 84000, 12600, 96600, je_inv, _user_id)
    RETURNING id INTO doc;
  INSERT INTO public.trade_document_lines (document_id, company_id, product_id, description, quantity, unit_price, tax_rate, line_total) VALUES
    (doc, _company_id, p_widget, 'Widget Pro', 90, 600, 15, 54000),
    (doc, _company_id, p_gadget, 'Gadget Mini', 120, 250, 15, 30000);

  -- Posted purchase order tied to JE-0003 (62,000)
  INSERT INTO public.trade_documents (company_id, branch_id, partner_id, kind, doc_no, doc_date, due_date, status, notes, subtotal, tax_total, total, journal_entry_id, created_by)
    VALUES (_company_id, dtn, supp, 'purchase_order', 'PO-1002', d - 70, d - 40, 'posted', 'Inventory restock', 62000, 0, 62000, je_po, _user_id)
    RETURNING id INTO doc;
  INSERT INTO public.trade_document_lines (document_id, company_id, product_id, description, quantity, unit_price, tax_rate, line_total) VALUES
    (doc, _company_id, p_widget, 'Widget Pro', 100, 300, 0, 30000),
    (doc, _company_id, p_gadget, 'Gadget Mini', 160, 200, 0, 32000);

  -- Draft quotation
  INSERT INTO public.trade_documents (company_id, branch_id, partner_id, kind, doc_no, doc_date, due_date, status, notes, subtotal, tax_total, total, created_by)
    VALUES (_company_id, hq, cust, 'quotation', 'QUO-3001', d - 3, d + 27, 'draft', 'Follow-up order proposal', 24000, 3600, 27600, _user_id)
    RETURNING id INTO doc;
  INSERT INTO public.trade_document_lines (document_id, company_id, product_id, description, quantity, unit_price, tax_rate, line_total) VALUES
    (doc, _company_id, p_widget, 'Widget Pro', 40, 600, 15, 24000);
END;
$$;

-- Extend the new-user bootstrap
CREATE OR REPLACE FUNCTION public.bootstrap_user_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  PERFORM public.seed_company_trade(cid, NEW.id);
  RETURN NEW;
END;
$$;

-- Backfill existing companies
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id, owner_id FROM public.companies LOOP
    PERFORM public.seed_company_trade(c.id, c.owner_id);
  END LOOP;
END;
$$;