-- Add translation_meta to i18n_glossary for change tracking
ALTER TABLE i18n_glossary ADD COLUMN IF NOT EXISTS translation_meta JSONB DEFAULT '{}'::jsonb;
