-- Concurrent-safe order numbers (fixes duplicate key on save quote)
CREATE SEQUENCE IF NOT EXISTS rental.order_number_seq;

SELECT setval(
  'rental.order_number_seq',
  GREATEST(
    1,
    COALESCE((
      SELECT MAX(NULLIF(regexp_replace(order_number, '\D', '', 'g'), '')::bigint)
      FROM rental.orders
    ), 0)
  )
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
