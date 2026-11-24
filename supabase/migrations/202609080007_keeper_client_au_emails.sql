-- Demo keeper accounts: use AU-looking emails (not .example placeholders).
UPDATE rental.clients SET
  email = v.email,
  updated_at = now()
FROM (VALUES
  ('CLOUGH PROJECTS', 'marcus.chen@clough.com.au'),
  ('FREO CRANES', 'ops@freocranes.com.au'),
  ('Harbour Rigging Services', 'ops@harbourrigging.com.au'),
  ('Hunter Valley Civil', 'sarah@hvcivil.com.au'),
  ('NWS Offshore Lift', 'chris@nwsoffshore.com.au'),
  ('Skyline Crane Hire', 'mei@skylinecrane.com.au')
) AS v(company_name, email)
WHERE rental.clients.company_name = v.company_name;
