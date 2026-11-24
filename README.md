# Rigging Rental ERP

Single-tenant equipment rental ERP — Next.js App Router, Supabase (`rental` schema), Tailwind, Shadcn UI.

## What leading RMS have vs this MVP

Researched against **Point of Rental**, **United Rentals Total Control**, and **Sunbelt Connected Solutions**.

### Now included (this iteration)

| Capability | Why leaders use it |
|------------|-------------------|
| Fleet utilization KPI dashboard | Daily ops visibility |
| Jobsite / delivery address / customer PO | Contract & ERP/PO workflow |
| Delivery & pickup logistics board | Multi-stop dispatch |
| Maintenance work orders (PM/repair/inspection/turnaround) | Reduce downtime |
| 14-day availability grid | Prevent overbooking |
| Client CRM rental history | Account management |
| Rich demo seed data | Realistic UX walkthrough |

### Still not in this MVP (enterprise backlog)

- Multi-branch / multi-location inventory transfer
- Customer self-serve portal & e-commerce booking
- Native payments (Stripe/ACH) & recurring long-term billing cycles automation
- Telematics / GPS / geofencing integrations
- E-sign contracts (DocuSign) & formal contract PDFs
- Parts inventory for shop repairs
- AI catalog copy / blur detection on inspections
- Accounting sync (QuickBooks/Sage)
- SMS/email alert automation
- Barcode/RFID hardware scanning beyond manual serial select

## Local setup

```bash
npm install
npm run dev
```

**Required:** Supabase → API → Exposed schemas → add `rental`.

Create a user in Auth, then:

```sql
UPDATE rental.profiles SET role = 'super_admin', full_name = 'Admin'
WHERE id = '<auth-user-uuid>';
```

## Demo seed (already loaded)

- 8 clients, 10 catalog models, 24 assets
- 10 orders across draft → invoiced
- Delivery/pickup tasks, maintenance WOs, sample invoices

## Routes

| Path | Purpose |
|------|---------|
| `/admin` | Utilization dashboard |
| `/admin/pipeline` | Kanban |
| `/admin/availability` | 14-day grid |
| `/admin/logistics` | Delivery/pickup board |
| `/admin/maintenance` | Work orders |
| `/admin/clients/[id]` | CRM history |
| `/workshop` | Mobile QC |
| `/billing` | Invoice approval |
