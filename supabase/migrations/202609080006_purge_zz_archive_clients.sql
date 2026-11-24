-- Hard-delete soft-archived demo clients and all related hire data.
DO $$
DECLARE
  archived_client_ids uuid[];
  archived_order_ids uuid[];
  archived_lead_ids uuid[];
  archived_invoice_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO archived_client_ids
  FROM rental.clients
  WHERE company_name LIKE 'ZZ Archive - %';

  IF cardinality(archived_client_ids) = 0 THEN
    RAISE NOTICE 'No ZZ Archive clients to purge';
    RETURN;
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO archived_order_ids
  FROM rental.orders
  WHERE client_id = ANY (archived_client_ids);

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO archived_lead_ids
  FROM rental.leads
  WHERE client_id = ANY (archived_client_ids)
     OR company_name LIKE 'ZZ Archive - %'
     OR converted_order_id = ANY (archived_order_ids);

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
  INTO archived_invoice_ids
  FROM rental.invoices
  WHERE order_id = ANY (archived_order_ids);

  UPDATE rental.leads
  SET converted_order_id = NULL
  WHERE converted_order_id = ANY (archived_order_ids);

  UPDATE rental.communications
  SET invoice_id = NULL
  WHERE invoice_id = ANY (archived_invoice_ids);

  UPDATE rental.generated_documents
  SET invoice_id = NULL
  WHERE invoice_id = ANY (archived_invoice_ids);

  DELETE FROM rental.communications
  WHERE order_id = ANY (archived_order_ids)
     OR lead_id = ANY (archived_lead_ids)
     OR invoice_id = ANY (archived_invoice_ids);

  DELETE FROM rental.generated_documents
  WHERE order_id = ANY (archived_order_ids)
     OR invoice_id = ANY (archived_invoice_ids);

  DELETE FROM rental.invoices
  WHERE id = ANY (archived_invoice_ids);

  DELETE FROM rental.orders
  WHERE id = ANY (archived_order_ids);

  DELETE FROM rental.leads
  WHERE id = ANY (archived_lead_ids)
     OR company_name LIKE 'ZZ Archive - %'
     OR client_id = ANY (archived_client_ids);

  DELETE FROM rental.clients
  WHERE id = ANY (archived_client_ids);
END $$;
