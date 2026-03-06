-- Enable pg_trgm for fuzzy card name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on collectibles.name for fast fuzzy matching
CREATE INDEX IF NOT EXISTS collectibles_name_trgm_idx
  ON collectibles USING gin (name gin_trgm_ops);
