# Primordium — App-Repo

Die Regeln stehen nicht hier.

| Was | Wo |
| --- | --- |
| Regeln | `~/Workspace/primordium/CLAUDE.md` |
| Aufgaben, Pakete, Deployment | `~/Workspace/primordium/STATE.md` |
| Artefakte (ER, Klassen, Komponenten, Flüsse, Mockups, Vertrag, Prüfmethode) | `~/Workspace/primordium/artefakte/` |
| Betrieb und SSO | `docs/betrieb.md`, `docs/sso-authentik.md` |
| Die Kette | `modell/README.md` |

## Worktree

```
cd ~/Workspace/primordium/app
git worktree add .claude/worktrees/<zweig> -b <zweig> main
```

Commits unsigniert: `git -c commit.gpgsign=false commit --no-verify`.

## Befehle

```
cd backend  && uv sync && uv run pytest && uv run ruff check . && uv run basedpyright
cd backend  && uv run python -m tools.check_comments && uv run python -m tools.check_size
cd frontend && npm ci && npm run lint && npm run typecheck && npm run test:ci && npm run build
cd frontend && npm run boards:sync && npm run e2e
cd frontend && npm run api:generate
cd backend  && uv run python -m tools.sync_contract
```

Erzeugte Dateien vor jedem PR nachziehen: `backend/daten/texte.json`
(`uv run python -m tools.sync_texts`), `backend/openapi.yaml`
(`uv run python -m tools.sync_contract`),
`frontend/src/app/core/i18n/texts.generated.json` (`npm run texts:sync`),
`frontend/src/app/core/api/contract.d.ts` (`npm run api:generate`).

## PR

```
git push -u origin <zweig>
gh pr create --base main
gh pr checks <nr>
```

Alle Jobs grün, dann Review. Merge und Deploy macht der Product Owner.
