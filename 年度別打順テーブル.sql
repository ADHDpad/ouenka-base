-- 年間の打順別スタメン起用実績を別途検証し、代表打順を確定してから登録する。
-- 未確認の推測値を入れないこと。
CREATE TABLE IF NOT EXISTS season_lineup_verified (
 year INTEGER NOT NULL, team TEXT NOT NULL, batting_order INTEGER NOT NULL CHECK(batting_order BETWEEN 1 AND 9),
 player_name TEXT NOT NULL, position TEXT NOT NULL, source_url TEXT NOT NULL,
 PRIMARY KEY(year,team,batting_order)
);
