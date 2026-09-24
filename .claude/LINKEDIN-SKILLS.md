# LinkedIn Skills (vendored)

Source: https://github.com/sergebulaev/linkedin-skills — v1.1.14, commit 5c6192d (MIT, see LICENSE-linkedin-skills).

Layout mirrors the upstream repo root so relative links keep working:
`skills/` (the 12 skills), `references/` (shared), `lib/` + `scripts/` (optional Publora/Apify publishing helpers).
Publishing needs `PUBLORA_API_KEY` etc. in `.claude/.env` (gitignored); without it the skills stay draft-only.

Update: re-clone upstream and re-copy `skills/linkedin-*`, `references/`, `lib/`.
