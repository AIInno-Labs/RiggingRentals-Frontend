-- Cap demo spike on INV-000212 so Ops billed-revenue chart stays readable.
update rental.invoice_lines
set unit_amount = 5713.64, line_total = 5713.64
where id = '0e8f07ee-3d06-40c2-a2d9-b53ea3ca1392';

update rental.invoices
set
  subtotal = 6363.64,
  gst_amount = 636.36,
  total = 7000.00,
  paid_amount = 7000.00,
  updated_at = now()
where id = 'f10b1e3d-575d-43b9-aea5-a25a2e39cfdc';
