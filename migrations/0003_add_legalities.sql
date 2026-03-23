-- Add format legalities JSONB column to collectibles
-- Stores MTG format legality as { "standard": "legal"|"not_legal"|"banned"|"restricted", ... }
-- Covers: standard, modern, legacy, vintage, commander, pioneer, pauper, and more
ALTER TABLE collectibles ADD COLUMN IF NOT EXISTS legalities JSONB;
