# Server Notes (lowdb – no native build)

1) Wallet `_game` untuk `registerGame` harus = address dari `SERVER_PRIVATE_KEY` (.env).
2) Endpoint:
   - `POST /submit-score` { player, username, score } → { ok, tx }
   - `GET /tx/:hash` → { stage, hash, ... } dengan stage: queued|pending|mined|error
   - `GET /leaderboard`
   - `GET /player/:addr`
3) DB: **lowdb (JSON)** dengan path via `DB_FILE` (default `./scores.json`).
   - Di Railway gunakan volume dan set `DB_FILE=/data/scores.json` agar persistent.
4) CORS: set `ALLOW_ORIGIN` berisi domain client.
5) Tidak ada dependency native, aman di Windows/Node terbaru.
