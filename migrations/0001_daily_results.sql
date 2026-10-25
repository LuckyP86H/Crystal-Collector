-- One row per player per daily puzzle: that player's best verified result.
-- player_id is a random UUID generated in the browser; no personal data is stored.
CREATE TABLE daily_results (
  day        TEXT    NOT NULL,
  player_id  TEXT    NOT NULL,
  clicks     INTEGER NOT NULL CHECK (clicks > 0),
  busts      INTEGER NOT NULL CHECK (busts >= 0),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (day, player_id)
) STRICT, WITHOUT ROWID;

-- Lets the histogram and rank queries read a single day without touching the table.
CREATE INDEX daily_results_day_clicks ON daily_results (day, clicks);
