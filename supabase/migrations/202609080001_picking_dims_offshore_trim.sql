-- Catalog dimensions for picking slips / invoices + offshore AU demo trim.

ALTER TABLE rental.equipment_catalog
  ADD COLUMN IF NOT EXISTS dimensions text NOT NULL DEFAULT '';

-- Seed realistic dimensions on active gear (print-friendly).
UPDATE rental.equipment_catalog SET dimensions = v.dims, updated_at = now()
FROM (VALUES
  ('HOIST-CHAIN', '1t x 3m lift'),
  ('HOIST-CHAIN-E', '2t x 6m lift'),
  ('HOIST-AIR', '1.5t x 5m lift'),
  ('HOIST-BUILD', '500kg x 12m'),
  ('HOIST-LEVER', '1.5t x 1.5m'),
  ('SLING-WEB', '2t x 2m'),
  ('SLING-CHAIN', '3.2t x 2m'),
  ('SLING-WIRE', '12cm x 20mtr'),
  ('SLING-ROUND', '3t x 2m'),
  ('LIFT-SHACK', '3.25t WLL'),
  ('LIFT-SHACK-SS', '4.75t WLL'),
  ('BEAM-LIFT', '2m x 5t'),
  ('BEAM-MOD', '3m modular'),
  ('LOFT-RIG', 'kit')
) AS v(sku, dims)
WHERE equipment_catalog.sku = v.sku
  AND (equipment_catalog.dimensions = '');

-- Keepers: MCS-style + offshore oil WA (rebrand in place, keep UUIDs / FKs).
UPDATE rental.clients AS c SET
  company_name = v.company_name,
  contact_name = v.contact_name,
  billing_address = v.billing_address,
  email = v.email,
  phone = v.phone,
  notes = v.notes,
  updated_at = now()
FROM (VALUES
  ('b08cd9f8-3aa4-4ec0-bee2-bfaf0a37bc46'::uuid,
   'FREO CRANES', 'James Walsh',
   '15 Kewdale Road, Welshpool WA 6106',
   'ops@freocranes.example', '+61 8 9358 4101',
   'AU demo - heavy lift / Fremantle'),
  ('a1000000-0000-0000-0000-000000000002'::uuid,
   'CLOUGH PROJECTS', 'Marcus Chen',
   'Level 12, 58 Mounts Bay Rd, Perth WA 6000',
   'marcus.chen@cloughprojects.example', '+61 8 9288 4100',
   'AU demo - offshore oil and gas EPCI'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,
   'NWS Offshore Lift', 'Chris Patil',
   'Lot 12 Great Northern Hwy, Port Hedland WA 6721',
   'chris@nwsoffshore.example', '+61 8 5550 2211',
   'AU demo - North West Shelf marine lift'),
  ('a1000000-0000-0000-0000-000000000001'::uuid,
   'Hunter Valley Civil', 'Sarah Mitchell',
   '14 Hunter St, Newcastle NSW 2300',
   'sarah@huntervalleycivil.example', '+61 2 5550 4101',
   'AU demo - civil (active yard jobs)'),
  ('716bce79-13c9-4de4-a04f-d72f6901e163'::uuid,
   'Harbour Rigging Services', 'Sam Harris',
   '42 Wharf St, Port Adelaide SA 5015',
   'ops@harbourrigging.example', '+61 8 5550 4017',
   'AU demo - marine rigging'),
  ('a1000000-0000-0000-0000-000000000011'::uuid,
   'Skyline Crane Hire', 'Mei Lin',
   '78 Industrial Dr, Tomago NSW 2322',
   'mei@skylinecranes.example', '+61 2 5550 4567',
   'AU demo - crane hire')
) AS v(id, company_name, contact_name, billing_address, email, phone, notes)
WHERE c.id = v.id;

-- Soft-archive remaining noisy demo clients (sort last; do not delete FKs).
UPDATE rental.clients
SET
  company_name = CASE
    WHEN company_name LIKE 'ZZ Archive - %' THEN company_name
    ELSE 'ZZ Archive - ' || company_name
  END,
  notes = CASE
    WHEN notes ILIKE '%archived demo%' THEN notes
    WHEN notes IS NULL OR notes = '' THEN 'archived demo'
    ELSE notes || E'\narchived demo'
  END,
  updated_at = now()
WHERE id NOT IN (
  'b08cd9f8-3aa4-4ec0-bee2-bfaf0a37bc46'::uuid,
  'a1000000-0000-0000-0000-000000000002'::uuid,
  'a1000000-0000-0000-0000-000000000012'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  '716bce79-13c9-4de4-a04f-d72f6901e163'::uuid,
  'a1000000-0000-0000-0000-000000000011'::uuid
)
AND company_name NOT LIKE 'ZZ Archive - %';

-- Align lead names for keepers / soft-archive junk leads.
UPDATE rental.leads SET
  company_name = CASE company_name
    WHEN 'Argus Marine Services' THEN 'FREO CRANES'
    WHEN 'Harbour Bridge JV' THEN 'CLOUGH PROJECTS'
    WHEN 'Redrock Mining Services' THEN 'NWS Offshore Lift'
    ELSE company_name
  END,
  updated_at = now()
WHERE company_name IN (
  'Argus Marine Services',
  'Harbour Bridge JV',
  'Redrock Mining Services'
);

UPDATE rental.leads
SET
  status = 'lost',
  notes = CASE
    WHEN notes ILIKE '%archived demo%' THEN notes
    ELSE trim(both E'\n' from coalesce(notes, '') || E'\narchived demo')
  END,
  updated_at = now()
WHERE status IN ('new', 'qualified')
  AND (
    company_name ILIKE '%landscape%'
    OR company_name ILIKE '%facade%'
    OR company_name ILIKE '%solar%'
    OR company_name ILIKE '%data centre%'
    OR company_name ILIKE '%stadium%'
    OR company_name ILIKE '%concrete%'
    OR notes ILIKE '%junk%'
  );
