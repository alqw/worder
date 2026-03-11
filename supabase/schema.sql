CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS words (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pack_id UUID REFERENCES packs(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    mastery_score INTEGER DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 5),
    last_reviewed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on packs" ON packs;
DROP POLICY IF EXISTS "Allow all on words" ON words;

CREATE POLICY "Allow all on packs" ON packs FOR ALL USING (true);
CREATE POLICY "Allow all on words" ON words FOR ALL USING (true);
