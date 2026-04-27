-- Add key column to i18n_glossary for UI strings mapping
ALTER TABLE i18n_glossary ADD COLUMN IF NOT EXISTS key TEXT;
CREATE INDEX IF NOT EXISTS idx_i18n_glossary_key ON i18n_glossary(key);
