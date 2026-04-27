-- i18n Automation: Glossary table and translation tracking metadata
-- Created At: 2026-04-26

-- 1. Create i18n_glossary table
CREATE TABLE IF NOT EXISTS i18n_glossary (
    id          BIGSERIAL PRIMARY KEY,
    category    TEXT,           -- 'mountain', 'station', 'hiking_term', 'ui', etc.
    ko          TEXT UNIQUE NOT NULL,
    en          TEXT NOT NULL,
    zh          TEXT,
    ja          TEXT,
    es          TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by KO source
CREATE INDEX IF NOT EXISTS idx_i18n_glossary_ko ON i18n_glossary(ko);

-- 2. Add translation_meta to relevant tables
-- This will store: { "last_synced_hash": "...", "translated_at": "...", "status": { "zh": "synced", ... } }

ALTER TABLE mountains    ADD COLUMN IF NOT EXISTS translation_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE waypoints    ADD COLUMN IF NOT EXISTS translation_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE segments     ADD COLUMN IF NOT EXISTS translation_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE routes       ADD COLUMN IF NOT EXISTS translation_meta JSONB DEFAULT '{}'::jsonb;
ALTER TABLE route_photos ADD COLUMN IF NOT EXISTS translation_meta JSONB DEFAULT '{}'::jsonb;

-- 3. Initial seeding of glossary (optional but helpful)
INSERT INTO i18n_glossary (category, ko, en)
VALUES 
    ('mountain', '북한산', 'Bukhansan'),
    ('mountain', '인왕산', 'Inwangsan'),
    ('mountain', '관악산', 'Gwanaksan'),
    ('mountain', '북악산', 'Bugaksan'),
    ('station', '북한산우이역', 'Bukhansan Ui Station'),
    ('station', '안국역', 'Anguk Station'),
    ('station', '관악산역', 'Gwanaksan Station'),
    ('hiking_term', '등산로 입구', 'Trailhead'),
    ('hiking_term', '정상', 'Summit'),
    ('hiking_term', '능선', 'Ridge'),
    ('hiking_term', '계곡', 'Valley'),
    ('hiking_term', '계곡물', 'Stream'),
    ('hiking_term', '전망대', 'Viewpoint'),
    ('ui', '안전 산행 마감 시간', 'Last safe start'),
    ('ui', '경로 이탈 알림', 'Off-route Alert')
ON CONFLICT (ko) DO UPDATE 
SET en = EXCLUDED.en, category = EXCLUDED.category;
