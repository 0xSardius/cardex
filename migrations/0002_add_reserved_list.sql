-- Add Reserved List flag to collectibles
-- The Reserved List is ~572 MTG cards that Wizards of the Coast promised never to reprint.
-- These are the most supply-constrained cards and primary targets for buyouts/speculation.
ALTER TABLE collectibles ADD COLUMN IF NOT EXISTS reserved BOOLEAN DEFAULT false;

-- Index for filtering reserved cards efficiently
CREATE INDEX IF NOT EXISTS collectibles_reserved_idx ON collectibles (reserved) WHERE reserved = true;
