CREATE OR REPLACE FUNCTION public.protect_posted_trade_document()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'Posted documents cannot be changed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trade_documents_protect_posted
BEFORE UPDATE OR DELETE ON public.trade_documents
FOR EACH ROW EXECUTE FUNCTION public.protect_posted_trade_document();

CREATE OR REPLACE FUNCTION public.protect_posted_trade_lines()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE st public.trade_doc_status;
BEGIN
  SELECT status INTO st FROM public.trade_documents
    WHERE id = COALESCE(NEW.document_id, OLD.document_id);
  IF st = 'posted' THEN
    RAISE EXCEPTION 'Lines of a posted document cannot be changed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trade_lines_protect_posted
BEFORE INSERT OR UPDATE OR DELETE ON public.trade_document_lines
FOR EACH ROW EXECUTE FUNCTION public.protect_posted_trade_lines();