-- Replace off-industry demo client name with AU rigging identity.
update rental.clients
set
  company_name = 'Harbour Rigging Services',
  contact_name = coalesce(nullif(contact_name, ''), 'Operations Desk'),
  notes = coalesce(notes, '') || case
    when notes is null or notes = '' then 'AU demo client (replaces off-industry seed)'
    when notes ilike '%AU demo client%' then ''
    else E'\nAU demo client (replaces off-industry seed)'
  end,
  updated_at = now()
where company_name ilike '%dertz%infotech%'
   or company_name ilike '%dertz%';
