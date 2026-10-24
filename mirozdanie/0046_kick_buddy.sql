-- Additive storage for Kick the Buddy. Apply only through the established hosted migration process.
CREATE TABLE kick_buddy_saves (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 save_json TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision > 0),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE kick_buddy_scores (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 damage INTEGER NOT NULL CHECK(damage BETWEEN 0 AND 5000000),
 combo INTEGER NOT NULL CHECK(combo BETWEEN 0 AND 10000),
 kos INTEGER NOT NULL CHECK(kos BETWEEN 0 AND 1),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
--> statement-breakpoint
CREATE INDEX kick_buddy_scores_recent ON kick_buddy_scores(created_at DESC);
--> statement-breakpoint
CREATE INDEX kick_buddy_scores_user_recent ON kick_buddy_scores(user_id,created_at DESC);
--> statement-breakpoint
CREATE TABLE kick_buddy_score_limits (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 last_score_at INTEGER NOT NULL,
 last_request_id TEXT NOT NULL
);
