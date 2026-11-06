ALTER TABLE public.trade_documents
  ADD COLUMN request_id uuid;

CREATE UNIQUE INDEX trade_documents_company_request_id_unique
  ON public.trade_documents (company_id, request_id)
  WHERE request_id IS NOT NULL;
