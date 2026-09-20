# Pilzkarte

[![CI](https://github.com/frederikbeimgraben/pilzkarte/actions/workflows/ci.yml/badge.svg)](https://github.com/frederikbeimgraben/pilzkarte/actions/workflows/ci.yml)

Web-App zur Pilzvorhersage in Deutschland. Die Karte zeigt je Kalenderwoche,
wo eine sammelbare Art wahrscheinlich wächst. Dazu Eingabe-Ebenen, ein
Faktor-Finder, ein Artenkatalog und eigene Funde, Marker und Zonen mit Konto.

Live: https://pilze.beimgraben.net/

| Ordner | Inhalt |
| --- | --- |
| `frontend/` | Angular 22, `@stupa-makers/ui-kit`, MapLibre GL, Terra Draw, PWA |
| `backend/` | Python 3.13, FastAPI, SQLAlchemy async, Alembic, SQLite, OIDC gegen Authentik |
| `modell/` | Vorhersagekette: GBIF und DWD laden, LightGBM je Art, Kacheln rendern |
| `docs/` | Betrieb und SSO |
| `deploy/` | rsync-Skripte für den Homeserver |

Betrieb: `docs/betrieb.md`. Befehle: Abschnitt „Befehle“.

## Befehle

```
cd backend  && uv sync && uv run pytest && uv run ruff check . && uv run basedpyright
cd backend  && uv run python -m tools.check_comments && uv run python -m tools.check_size
cd frontend && npm ci && npm run lint && npm run typecheck && npm run test:ci && npm run build
cd frontend && npm run e2e
```

Ziehe die erzeugten Dateien vor jedem PR nach: `backend/daten/texte.json`
(`uv run python -m tools.sync_texts`), `backend/openapi.yaml`
(`uv run python -m tools.sync_contract`),
`frontend/src/app/core/i18n/texts.generated.json` (`npm run texts:sync`),
`frontend/src/app/core/api/contract.d.ts` (`npm run api:generate`).

## Lizenz

GPL-3.0-or-later, siehe `LICENSE`.
