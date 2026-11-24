-- Align all demo clients to AU company names, contacts, phones, and addresses.
UPDATE rental.clients AS c SET
  company_name = v.company_name,
  contact_name = v.contact_name,
  billing_address = v.billing_address,
  email = v.email,
  phone = v.phone,
  notes = CASE
    WHEN c.notes ILIKE '%AU demo client%' THEN c.notes
    WHEN c.notes IS NULL OR c.notes = '' THEN 'AU demo client'
    ELSE c.notes || E'\nAU demo client'
  END,
  updated_at = now()
FROM (VALUES
  ('a1000000-0000-0000-0000-000000000001'::uuid,
   'Hunter Valley Civil', 'Sarah Mitchell', '14 Hunter St, Newcastle NSW 2300',
   'sarah@huntervalleycivil.example', '+61 2 5550 4101'),
  ('9d642037-b391-4279-93db-d29789d78268',
   'Apex Build Group', 'Marcus Vance', '220 Pacific Hwy, North Sydney NSW 2060',
   'mvance@apexbuildgroup.example', '+61 2 5550 9821'),
  ('b08cd9f8-3aa4-4ec0-bee2-bfaf0a37bc46',
   'Argus Marine Services', 'James Walsh', '12 Slipway Rd, Fremantle WA 6160',
   'james@argusmarine.example', '+61 8 5550 4160'),
  ('a1000000-0000-0000-0000-000000000014',
   'Atlas Data Centres', 'Ryan Shah', '88 Innovation Dr, Macquarie Park NSW 2113',
   'ryan@atlasdc.example', '+61 2 5550 0164'),
  ('a1000000-0000-0000-0000-000000000010',
   'Bay Concrete Pumping', 'Daniel Alvarez', '45 Industrial Ave, Pinkenba QLD 4008',
   'daniel@bayconcrete.example', '+61 7 5550 0133'),
  ('a1000000-0000-0000-0000-000000000007',
   'Coastal Wind Services', 'Sophie Berg', '9 Harbour Rd, Geraldton WA 6530',
   'sophie@coastalwind.example', '+61 8 5550 0190'),
  ('a1000000-0000-0000-0000-000000000004',
   'Outback Solar EPC', 'Omar Haddad', '22 Barrier Hwy, Broken Hill NSW 2880',
   'omar@outbacksolar.example', '+61 8 5550 4567'),
  ('8429dc70-94c8-4981-84cb-c5dab8151ead',
   'Drymatter Logistics', 'Chris Owens', '7 Freight Hub Rd, Wetherill Park NSW 2164',
   'chris@drymatter.example', '+61 2 5550 3434'),
  ('aa9e2070-b434-4e84-98f8-7f892589b0fc',
   'Fulcrum Industrial', 'Marcus Vance', '18 Forge St, Wingfield SA 5013',
   'marcus@fulcrumind.example', '+61 8 5550 2200'),
  ('a1000000-0000-0000-0000-000000000006',
   'Greenfield Landscapes', 'Tom Bradley', '90 Canterbury Rd, Bayswater VIC 3153',
   'tom@greenfield.example', '+61 3 5550 0199'),
  ('a1000000-0000-0000-0000-000000000002',
   'Harbour Bridge JV', 'Marcus Chen', '88 Hickson Rd, Millers Point NSW 2000',
   'marcus@harbourbridge.example', '+61 2 5550 0142'),
  ('716bce79-13c9-4de4-a04f-d72f6901e163',
   'Harbour Rigging Services', 'Sam Harris', '42 Wharf St, Port Adelaide SA 5015',
   'ops@harbourrigging.example', '+61 8 5550 4017'),
  ('a1000000-0000-0000-0000-000000000015',
   'Stadium Ops Australia', 'Leah Brooks', '1 Olympic Blvd, Sydney Olympic Park NSW 2127',
   'leah@stadiumops.example', '+61 2 5550 0112'),
  ('dda8d5a8-d20b-4489-b4f9-80d7ad42d2ea',
   'Kestrel Fabrication', 'Sam Harris', '5 Workshop Lane, Geelong VIC 3220',
   'sam@kestrelfab.example', '+61 3 5550 4017'),
  ('a1000000-0000-0000-0000-000000000013',
   'Lakeview Marina Works', 'Nora Quinn', '16 Wharf Rd, Geelong VIC 3220',
   'nora@lakeviewmarina.example', '+61 3 5550 0188'),
  ('a1000000-0000-0000-0000-000000000005',
   'Metro Tunneling Co', 'Anita Bose', '110 George St, Parramatta NSW 2150',
   'anita@metrotunnel.example', '+61 2 5550 2011'),
  ('a1000000-0000-0000-0000-000000000009',
   'Northern Pipeline Ltd', 'Hannah Cole', '44 Stuart Hwy, Darwin NT 0800',
   'hannah@northpipe.example', '+61 8 5550 0177'),
  ('a1000000-0000-0000-0000-000000000012',
   'Redrock Mining Services', 'Chris Patil', 'Lot 12 Great Northern Hwy, Port Hedland WA 6721',
   'chris@redrock.example', '+61 8 5550 2211'),
  ('a1000000-0000-0000-0000-000000000011',
   'Skyline Crane Hire', 'Mei Lin', '78 Industrial Dr, Tomago NSW 2322',
   'mei@skylinecranes.example', '+61 2 5550 4567'),
  ('a1000000-0000-0000-0000-000000000003',
   'Summit Event Rigging', 'Elena Rossi', '14 Warehouse Lane, Port Melbourne VIC 3207',
   'elena@summitrig.example', '+61 3 5550 0958'),
  ('a1000000-0000-0000-0000-000000000008',
   'Urban Facade Systems', 'James Okonkwo', '55 Bourke St, Melbourne VIC 3000',
   'james@urbanfacade.example', '+61 3 5550 0191')
) AS v(id, company_name, contact_name, billing_address, email, phone)
WHERE c.id = v.id;

-- Keep lead company names aligned when they still mirror old demo clients.
UPDATE rental.leads SET
  company_name = CASE company_name
    WHEN 'Apex Civil Constructors' THEN 'Hunter Valley Civil'
    WHEN 'Apexbuildgroup' THEN 'Apex Build Group'
    WHEN 'Argus' THEN 'Argus Marine Services'
    WHEN 'Atlas Data Centers' THEN 'Atlas Data Centres'
    WHEN 'Desert Solar EPC' THEN 'Outback Solar EPC'
    WHEN 'Dertz Infotech' THEN 'Harbour Rigging Services'
    WHEN 'Drymatter' THEN 'Drymatter Logistics'
    WHEN 'Fulcrum Technologies' THEN 'Fulcrum Industrial'
    WHEN 'Harbor Bridge JV' THEN 'Harbour Bridge JV'
    WHEN 'Horizon Stadium Ops' THEN 'Stadium Ops Australia'
    WHEN 'KGB' THEN 'Kestrel Fabrication'
    WHEN 'Skyline Cranes Hire' THEN 'Skyline Crane Hire'
    ELSE company_name
  END,
  updated_at = now()
WHERE company_name IN (
  'Apex Civil Constructors',
  'Apexbuildgroup',
  'Argus',
  'Atlas Data Centers',
  'Desert Solar EPC',
  'Dertz Infotech',
  'Drymatter',
  'Fulcrum Technologies',
  'Harbor Bridge JV',
  'Horizon Stadium Ops',
  'KGB',
  'Skyline Cranes Hire'
);
