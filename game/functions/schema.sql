-- runs: one row for each run begun (a ticket). best: the best score of each player for each day and for all time (day = 'all').
-- hist: how many players of a board stand in each band of 250 points, so a place is counted without reading the whole board.
-- cards: the number of a finished run's card, given once, in the order the runs were finished.
CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, pid TEXT NOT NULL, t0 INTEGER NOT NULL, iph TEXT, cc TEXT, sec INTEGER NOT NULL DEFAULT 0, marks TEXT NOT NULL DEFAULT '',
  ts INTEGER, score INTEGER NOT NULL DEFAULT 0, lamps INTEGER, dist INTEGER, won INTEGER, falls INTEGER, done INTEGER NOT NULL DEFAULT 0, name TEXT, title TEXT);
CREATE INDEX IF NOT EXISTS runs_iph ON runs (iph, t0);
CREATE TABLE IF NOT EXISTS best (day TEXT NOT NULL, pid TEXT NOT NULL, name TEXT, cc TEXT, title TEXT, score INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (day, pid));
CREATE INDEX IF NOT EXISTS best_rank ON best (day, score DESC, ts);
CREATE TABLE IF NOT EXISTS hist (day TEXT NOT NULL, b INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, b));
CREATE TABLE IF NOT EXISTS cards (n INTEGER PRIMARY KEY AUTOINCREMENT, run TEXT NOT NULL UNIQUE);
