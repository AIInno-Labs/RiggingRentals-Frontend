-- Resync order sequence after out-of-band / QA order numbers (e.g. RO-209297)
-- Only count standard RO-###### numbers so E2E ids don't inflate the sequence.

CREATE SEQUENCE IF NOT EXISTS rental.order_number_seq;

SELECT setval(
  'rental.order_number_seq',
  GREATEST(
    1,
    COALESCE((
      SELECT MAX(
        NULLIF(substring(order_number FROM '^RO-([0-9]+)$'), '')::bigint
      )
      FROM rental.orders
      WHERE order_number ~ '^RO-[0-9]+$'
    ), 0)
  ),
  true
);

CREATE OR REPLACE FUNCTION rental.next_order_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'rental', 'public'
AS $function$
DECLARE
  n bigint;
BEGIN
  n := nextval('rental.order_number_seq');
  RETURN 'RO-' || lpad(n::text, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'rental', 'public'
AS $function$
  SELECT rental.next_order_number();
$function$;

GRANT EXECUTE ON FUNCTION public.next_order_number() TO authenticated, anon, service_role;
