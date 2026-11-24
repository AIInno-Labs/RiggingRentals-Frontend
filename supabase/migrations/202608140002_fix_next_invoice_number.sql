-- Invoice numbers must use MAX(numeric)+1, not COUNT(*)+1.
-- Seed / historical gaps (e.g. INV-000201) made COUNT collide with existing INV-0000NN.

CREATE OR REPLACE FUNCTION rental.next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'rental', 'public'
AS $function$
DECLARE n bigint;
BEGIN
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(invoice_number, '\D', '', 'g'), '')::bigint),
    0
  ) + 1
  INTO n
  FROM rental.invoices;
  RETURN 'INV-' || lpad(n::text, 6, '0');
END;
$function$;
