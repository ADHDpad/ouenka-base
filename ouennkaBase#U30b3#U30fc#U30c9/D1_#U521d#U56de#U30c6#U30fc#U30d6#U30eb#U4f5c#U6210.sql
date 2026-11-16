-- Cloudflare D1 > Console で一度だけ実行
CREATE TABLE IF NOT EXISTS season_lineup_verified (
  year INTEGER NOT NULL,
  team TEXT NOT NULL,
  batting_order INTEGER NOT NULL CHECK (batting_order BETWEEN 1 AND 9),
  player_name TEXT NOT NULL,
  position TEXT NOT NULL,
  source_url TEXT NOT NULL,
  PRIMARY KEY (year,team,batting_order)
);
