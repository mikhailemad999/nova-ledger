CREATE OR REPLACE FUNCTION public.create_trade_document_draft(
  p_company_id uuid,
  p_kind public.trade_doc_kind,
  p_branch_id uuid,
  p_partner_id uuid,
  p_doc_date date,
  p_due_date date,
  p_notes text,
  p_request_id uuid,
  p_lines jsonb
)
RETURNS TABLE(id uuid, doc_no text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc_id uuid;
  v_doc_no text;
  v_existing_status public.trade_doc_status;
  v_next_number bigint;
  v_subtotal numeric(18,2);
  v_tax_total numeric(18,2);
  v_prefix text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_role(
    auth.uid(), p_company_id,
    ARRAY['super_admin','owner','admin','accountant','manager']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'Forbidden: sales.manage requires a manager or higher role';
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'At least one document line is required';
  END IF;
  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches b WHERE b.id = p_branch_id AND b.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Branch does not belong to this company';
  END IF;
  IF p_partner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.partners p WHERE p.id = p_partner_id AND p.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Partner does not belong to this company';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lines) AS item(line)
    LEFT JOIN public.products p
      ON p.id = NULLIF(item.line->>'product_id', '')::uuid
      AND p.company_id = p_company_id
    WHERE NULLIF(item.line->>'product_id', '') IS NOT NULL AND p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A product does not belong to this company';
  END IF;

  SELECT ROUND(COALESCE(SUM((line->>'quantity')::numeric * (line->>'unit_price')::numeric), 0), 2),
         ROUND(COALESCE(SUM((line->>'quantity')::numeric * (line->>'unit_price')::numeric * (line->>'tax_rate')::numeric / 100), 0), 2)
    INTO v_subtotal, v_tax_total
    FROM jsonb_array_elements(p_lines) AS items(line);

  PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::text || ':' || p_kind::text, 0));

  SELECT d.id, d.doc_no, d.status INTO v_doc_id, v_doc_no, v_existing_status
    FROM public.trade_documents d
    WHERE d.company_id = p_company_id AND d.request_id = p_request_id;
  IF v_doc_id IS NOT NULL THEN
    IF v_existing_status <> 'draft' THEN
      RAISE EXCEPTION 'This request already created a document that can no longer be edited';
    END IF;
    UPDATE public.trade_documents d
       SET branch_id = p_branch_id, partner_id = p_partner_id, doc_date = p_doc_date,
           due_date = p_due_date, notes = p_notes, subtotal = v_subtotal,
           tax_total = v_tax_total, total = v_subtotal + v_tax_total
     WHERE d.id = v_doc_id AND d.company_id = p_company_id AND d.status = 'draft';
    DELETE FROM public.trade_document_lines l
     WHERE l.document_id = v_doc_id AND l.company_id = p_company_id;
    INSERT INTO public.trade_document_lines (
      document_id, company_id, product_id, description, quantity, unit_price, tax_rate, line_total
    )
    SELECT v_doc_id, p_company_id, NULLIF(line->>'product_id', '')::uuid,
           NULLIF(line->>'description', ''), (line->>'quantity')::numeric,
           (line->>'unit_price')::numeric, COALESCE((line->>'tax_rate')::numeric, 0),
           ROUND((line->>'quantity')::numeric * (line->>'unit_price')::numeric, 2)
      FROM jsonb_array_elements(p_lines) AS items(line);
    RETURN QUERY SELECT v_doc_id, v_doc_no;
    RETURN;
  END IF;

  v_prefix := CASE p_kind WHEN 'quotation' THEN 'QUO' WHEN 'invoice' THEN 'INV' ELSE 'PO' END;
  SELECT COALESCE(MAX(SUBSTRING(d.doc_no FROM '([0-9]+)$')::bigint), 0) + 1
    INTO v_next_number
    FROM public.trade_documents d
    WHERE d.company_id = p_company_id AND d.kind = p_kind;
  v_doc_no := v_prefix || '-' || LPAD(v_next_number::text, 4, '0');

  INSERT INTO public.trade_documents (
    company_id, branch_id, partner_id, kind, doc_no, doc_date, due_date,
    status, notes, subtotal, tax_total, total, created_by, request_id
  ) VALUES (
    p_company_id, p_branch_id, p_partner_id, p_kind, v_doc_no, p_doc_date, p_due_date,
    'draft', p_notes, v_subtotal, v_tax_total, v_subtotal + v_tax_total, auth.uid(), p_request_id
  ) ON CONFLICT (company_id, request_id) WHERE request_id IS NOT NULL DO NOTHING
  RETURNING trade_documents.id, trade_documents.doc_no INTO v_doc_id, v_doc_no;

  IF v_doc_id IS NULL THEN
    SELECT d.id, d.doc_no INTO v_doc_id, v_doc_no
      FROM public.trade_documents d
      WHERE d.company_id = p_company_id AND d.request_id = p_request_id;
    RETURN QUERY SELECT v_doc_id, v_doc_no;
    RETURN;
  END IF;

  INSERT INTO public.trade_document_lines (
    document_id, company_id, product_id, description, quantity, unit_price, tax_rate, line_total
  )
  SELECT v_doc_id, p_company_id, NULLIF(line->>'product_id', '')::uuid,
         NULLIF(line->>'description', ''), (line->>'quantity')::numeric,
         (line->>'unit_price')::numeric, COALESCE((line->>'tax_rate')::numeric, 0),
         ROUND((line->>'quantity')::numeric * (line->>'unit_price')::numeric, 2)
    FROM jsonb_array_elements(p_lines) AS items(line);

  RETURN QUERY SELECT v_doc_id, v_doc_no;
END;
$$;
REVOKE ALL ON FUNCTION public.create_trade_document_draft(uuid, public.trade_doc_kind, uuid, uuid, date, date, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_trade_document_draft(uuid, public.trade_doc_kind, uuid, uuid, date, date, text, uuid, jsonb) TO authenticated;
