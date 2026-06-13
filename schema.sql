DROP TABLE IF EXISTS profile_visits;
DROP TABLE IF EXISTS verifications;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT,
    session_token TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    onboarding_complete INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    platform_username TEXT NOT NULL,
    access_token_enc TEXT, -- Encrypted tokens stored as text/base64
    refresh_token_enc TEXT,
    token_expires_at TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    verified_at TEXT,
    last_checked_at TEXT,
    metadata_json TEXT, -- SQLite stores JSON as text
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, platform)
);

CREATE TABLE profile_visits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    visitor_ip TEXT,
    visitor_user_agent TEXT,
    referrer TEXT,
    visited_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_slug ON users(slug);
CREATE INDEX idx_users_session ON users(session_token);
CREATE INDEX idx_verifications_platform ON verifications(platform, platform_user_id);
CREATE INDEX idx_visits_user ON profile_visits(user_id, visited_at);
