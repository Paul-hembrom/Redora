-- Readora AI Video Pipeline & Chat Enhancements Migration

-- 1. Alter Existing Tables
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

ALTER TABLE chats 
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS action_data TEXT,
  ADD COLUMN IF NOT EXISTS recommended_videos TEXT;

-- 2. Create Video Generation Tables
CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    document_id TEXT,
    chapter_id TEXT,
    status TEXT,
    progress INTEGER,
    error_message TEXT,
    video_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storyboards (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    chapter_id TEXT REFERENCES chapters(id) ON DELETE CASCADE,
    generation_job_id TEXT,
    title TEXT NOT NULL,
    visual_style TEXT,
    narration_style TEXT,
    grade_level TEXT,
    subject TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL,
    scene_number INTEGER NOT NULL,
    narration TEXT,
    visual_prompt TEXT,
    estimated_duration_seconds INTEGER,
    labels TEXT DEFAULT '[]',
    educational_metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS narration_assets (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    scene_id TEXT,
    asset_url TEXT,
    voice_name TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visual_metadata (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    scene_id TEXT,
    image_url TEXT,
    prompt TEXT,
    model_used TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
