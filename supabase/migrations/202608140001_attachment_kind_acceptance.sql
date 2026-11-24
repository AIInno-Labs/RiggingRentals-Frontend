-- Allow T&Cs acceptance proof uploads on quotes
ALTER TYPE rental.attachment_kind ADD VALUE IF NOT EXISTS 'acceptance';
