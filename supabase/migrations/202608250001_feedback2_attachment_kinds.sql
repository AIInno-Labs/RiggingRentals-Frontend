-- Feedback 2: new attachment kinds (enum values must be committed before use).
ALTER TYPE rental.attachment_kind ADD VALUE IF NOT EXISTS 'picking_slip';
ALTER TYPE rental.attachment_kind ADD VALUE IF NOT EXISTS 'return_notes';
