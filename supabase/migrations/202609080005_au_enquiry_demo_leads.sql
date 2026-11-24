-- Soft-close off-industry enquiry demos; ensure AU keeper enquiries.

UPDATE rental.leads
SET
  status = 'lost',
  notes = CASE
    WHEN notes ILIKE '%archived demo%' THEN notes
    ELSE trim(both E'\n' from coalesce(notes, '') || E'\narchived demo — off AU rigging set')
  END,
  updated_at = now()
WHERE status IN ('new', 'qualified', 'quoted')
  AND (
    company_name ILIKE '%fulcrum%'
    OR company_name ILIKE '%drymatter%'
    OR company_name ILIKE '%kestrel%'
    OR company_name ILIKE '%apex build%'
    OR company_name ILIKE '%apex civil%'
    OR notes ILIKE '%generator%'
    OR notes ILIKE '%excavator%'
    OR notes ILIKE '%nuclear%'
    OR notes ILIKE '%Industrial Parkway%'
    OR phone IN ('343434343434', '(555) 014-9821')
  );

UPDATE rental.leads l
SET
  company_name = v.company_name,
  contact_name = v.contact_name,
  email = v.email,
  phone = v.phone,
  notes = v.notes,
  estimate_notes = v.estimate_notes,
  estimated_value = v.estimated_value,
  status = 'qualified',
  source = 'email',
  updated_at = now()
FROM (VALUES
  ('Harbour Rigging Services', 'Sam Harris', 'sam@harbourrigging.com.au', '08 8447 5910',
   E'Subject: Spreader beam + shackles — Outer Harbor shutdown\n\nNeed 2x modular spreader beams and Grade 8 shackles for a 10-day plant shutdown at Outer Harbor (Port Adelaide). Prefer AU-certified gear with current LOLER.',
   'Spreader beams, shackles — Outer Harbor', 8500::numeric),
  ('FREO CRANES', 'James Walsh', 'james@freocranes.com.au', '08 9430 2100',
   E'Subject: Man cage + taglines — Fremantle wharf lift\n\nLooking for a certified man cage and tagline kit for a 5-day wharf job in Fremantle.',
   'Man cage, taglines — Fremantle', 4200::numeric),
  ('CLOUGH PROJECTS', 'Marcus Chen', 'marcus.chen@clough.com.au', '08 9288 3000',
   E'Subject: Water bags + load cells — Kwinana turnaround\n\nNeed water bags and calibrated load cells for a 3-week turnaround at Kwinana.',
   'Water bags, load cells — Kwinana', 18600::numeric),
  ('NWS Offshore Lift', 'Chris Patil', 'chris.patil@nwsoffshore.com.au', '08 6210 4400',
   E'Subject: Offshore sling set — Dampier mobilisation\n\nRequire a full sling set for a 14-day mobilisation out of Dampier. Must be NDT-current.',
   'Sling set — Dampier', 12400::numeric),
  ('Hunter Valley Civil', 'Sarah Mitchell', 'sarah@hvcivil.com.au', '02 4929 8800',
   E'Subject: Portable gantry + chain blocks — Tomago yard\n\nPortable gantry and 2x chain blocks for 4 weeks at Tomago yard.',
   'Gantry, chain blocks — Tomago', 9800::numeric),
  ('Skyline Crane Hire', 'Mei Lin', 'mei@skylinecrane.com.au', '02 4964 1200',
   E'Subject: Test weights + stools — Newcastle proof load\n\nCalibrated test weights and stand/stools for a Newcastle proof-load weekend.',
   'Test weights, stools — Newcastle', 6400::numeric)
) AS v(company_name, contact_name, email, phone, notes, estimate_notes, estimated_value)
WHERE l.company_name = v.company_name
  AND l.status IN ('new', 'qualified', 'quoted');

INSERT INTO rental.leads (
  source, company_name, contact_name, email, phone, notes, estimate_notes,
  estimated_value, status
)
SELECT
  'email',
  v.company_name,
  v.contact_name,
  v.email,
  v.phone,
  v.notes,
  v.estimate_notes,
  v.estimated_value,
  'qualified'
FROM (VALUES
  ('Harbour Rigging Services', 'Sam Harris', 'sam@harbourrigging.com.au', '08 8447 5910',
   E'Subject: Spreader beam + shackles — Outer Harbor shutdown\n\nNeed 2x modular spreader beams and Grade 8 shackles for a 10-day plant shutdown at Outer Harbor.',
   'Spreader beams, shackles — Outer Harbor', 8500::numeric),
  ('FREO CRANES', 'James Walsh', 'james@freocranes.com.au', '08 9430 2100',
   E'Subject: Man cage + taglines — Fremantle wharf lift\n\nLooking for a certified man cage and tagline kit for a 5-day wharf job in Fremantle.',
   'Man cage, taglines — Fremantle', 4200::numeric),
  ('CLOUGH PROJECTS', 'Marcus Chen', 'marcus.chen@clough.com.au', '08 9288 3000',
   E'Subject: Water bags + load cells — Kwinana turnaround\n\nNeed water bags and calibrated load cells for a 3-week turnaround at Kwinana.',
   'Water bags, load cells — Kwinana', 18600::numeric),
  ('NWS Offshore Lift', 'Chris Patil', 'chris.patil@nwsoffshore.com.au', '08 6210 4400',
   E'Subject: Offshore sling set — Dampier mobilisation\n\nRequire a full sling set for a 14-day mobilisation out of Dampier. Must be NDT-current.',
   'Sling set — Dampier', 12400::numeric),
  ('Hunter Valley Civil', 'Sarah Mitchell', 'sarah@hvcivil.com.au', '02 4929 8800',
   E'Subject: Portable gantry + chain blocks — Tomago yard\n\nPortable gantry and 2x chain blocks for 4 weeks at Tomago yard.',
   'Gantry, chain blocks — Tomago', 9800::numeric),
  ('Skyline Crane Hire', 'Mei Lin', 'mei@skylinecrane.com.au', '02 4964 1200',
   E'Subject: Test weights + stools — Newcastle proof load\n\nCalibrated test weights and stand/stools for a Newcastle proof-load weekend.',
   'Test weights, stools — Newcastle', 6400::numeric)
) AS v(company_name, contact_name, email, phone, notes, estimate_notes, estimated_value)
WHERE NOT EXISTS (
  SELECT 1 FROM rental.leads x
  WHERE x.company_name = v.company_name
    AND x.status IN ('new', 'qualified', 'quoted')
);
