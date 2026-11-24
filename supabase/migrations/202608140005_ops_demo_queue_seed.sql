-- Demo seed: make Billing / Logistics / Sales queues visible on Command Center.
-- Prefer updating existing demo rows.

-- Billing: 3 approved unpaid invoices become overdue
UPDATE rental.invoices i
SET payment_due_at = CURRENT_DATE - 14
WHERE i.id IN (
  SELECT id FROM rental.invoices
  WHERE status = 'approved'
    AND paid_at IS NULL
  ORDER BY COALESCE(approved_at, created_at) DESC
  LIMIT 3
);

-- Sales: 2 draft quotes expire within 7 days
UPDATE rental.orders o
SET quote_valid_until = CURRENT_DATE + 3
WHERE o.id IN (
  SELECT id FROM rental.orders
  WHERE status = 'draft'
  ORDER BY updated_at DESC
  LIMIT 2
);

-- Logistics: mark up to 2 dispatched hires as awaiting pickup
UPDATE rental.orders o
SET status = 'off_rent_pending',
    end_at = COALESCE(o.end_at, now() + interval '1 day')
WHERE o.id IN (
  SELECT id FROM rental.orders
  WHERE status = 'dispatched'
  ORDER BY updated_at DESC
  LIMIT 2
);

-- Keep delivery tasks scheduled for demo (touch updated_at on a few)
UPDATE rental.delivery_tasks d
SET status = 'scheduled',
    scheduled_at = COALESCE(d.scheduled_at, now() + interval '1 day'),
    updated_at = now()
WHERE d.id IN (
  SELECT id FROM rental.delivery_tasks
  WHERE status IN ('scheduled', 'en_route', 'completed')
  ORDER BY CASE WHEN status IN ('scheduled','en_route') THEN 0 ELSE 1 END, updated_at DESC
  LIMIT 4
);
