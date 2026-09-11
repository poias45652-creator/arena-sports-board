-- Additive migration: preserve all existing Arena accounts, sessions and legacy bindings.
CREATE TABLE IF NOT EXISTS arena_users (
 id text PRIMARY KEY, username text UNIQUE NOT NULL, password_salt text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL DEFAULT 'member', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS arena_sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES arena_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arena_sessions_user_idx ON arena_sessions(user_id);
CREATE TABLE IF NOT EXISTS arena_auth_attempts (key text PRIMARY KEY, attempts integer NOT NULL, window_end bigint NOT NULL);
CREATE TABLE IF NOT EXISTS tz_bindings (
 member_id text PRIMARY KEY REFERENCES arena_users(id) ON DELETE CASCADE,
 source_user_id text NOT NULL, username text NOT NULL, device_id text NOT NULL,
 encrypted_token text NOT NULL, expires_at bigint NOT NULL, verified_at bigint NOT NULL, game_url text
);
CREATE TABLE IF NOT EXISTS tz_binding_attempts (
 member_id text PRIMARY KEY REFERENCES arena_users(id) ON DELETE CASCADE, allowed_at bigint NOT NULL, operation_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS hr_connections (
 member_id text PRIMARY KEY REFERENCES tz_bindings(member_id) ON DELETE CASCADE,
 binding_version bigint NOT NULL, encrypted_session text, snapshot text, fetched_at bigint,
 last_error text, error_code text, busy_until bigint NOT NULL DEFAULT 0, operation_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS analysis_snapshots (
 id text PRIMARY KEY, game_id bigint NOT NULL, start_time text NOT NULL,
 captured_at text NOT NULL, version text NOT NULL, payload text NOT NULL
);
CREATE INDEX IF NOT EXISTS analysis_game_captured ON analysis_snapshots(game_id,captured_at);
CREATE INDEX IF NOT EXISTS analysis_start ON analysis_snapshots(start_time);
CREATE TABLE IF NOT EXISTS analysis_results (
 game_id bigint PRIMARY KEY, scheduled_start text, away integer NOT NULL, home integer NOT NULL, fetched_at text NOT NULL
);

ALTER TABLE analysis_snapshots ADD COLUMN IF NOT EXISTS member_id text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS analysis_member_game ON analysis_snapshots(member_id,game_id,captured_at);
