"""The forecast horizons of the chain.

A horizon is the distance in weeks between the last week with weather and the
week that the model answers for. Horizon 0 serves a week that already
happened. A larger horizon hides every column that reaches into the unknown.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from datetime import date
from pathlib import Path

# The horizons that the final model is built for, in weeks.
HORIZONS = (0, 1, 2, 3, 4)
# The windows of the activity features, in days.
WINDOWS = (7, 14, 21)
# The weeks that a run reaches past the last week with weather.
LEAD = 2


def activity_names(horizon: int = 0) -> list[str]:
    """Column names of the activity features for one horizon."""
    suffix = f"_h{horizon}" if horizon else ""
    return [f"activity_rate_{w}d{suffix}" for w in WINDOWS]


def knowable(name: str, horizon: int) -> bool:
    """Is a weather column known when the target week is `horizon` weeks away?

    Weather at lag k is known only when k >= horizon. A rolling window, an
    anomaly or a temperature drop ends at the target week and reaches into
    the unknown.
    """
    if horizon == 0:
        return True
    lag = re.search(r"_lag(\d+)$", name)
    if lag:
        return int(lag.group(1)) >= horizon
    if re.search(r"_(sum|mean)\d+$", name) or name.endswith(("_anom", "_ratio")):
        return False
    return not name.startswith("tas_drop")


def horizon_for(week_id: int, observed_last: int | None,
                available: Sequence[int]) -> int:
    """The horizon that one week takes.

    A week up to the last week with weather takes horizon 0. A week past it
    takes the smallest horizon that is at least its distance. Such a model
    reads no column that the week lacks. Without one the run stops.
    """
    if observed_last is None or week_id <= observed_last:
        return 0
    abstand = int(week_id) - int(observed_last)
    passend = [h for h in sorted(available) if h >= abstand]
    if not passend:
        raise SystemExit(
            f"das Bundle hat kein Modell fuer Horizont {abstand}; "
            f"vorhanden sind {sorted(available)}. Trainiere die Art neu oder "
            f"setze --forecast auf hoechstens {max(available)}.")
    return passend[0]


def shared_horizon(available: Iterable[Iterable[int]]) -> int:
    """The largest horizon that every bundle carries."""
    saetze = [set(einzeln) for einzeln in available]
    if not saetze:
        return 0
    gemeinsam = set.intersection(*saetze)
    return max(gemeinsam) if gemeinsam else 0


def forecast_weeks(today: date, observed: tuple[int, int] | None,
                   cap: int = max(HORIZONS), lead: int = LEAD) -> int:
    """How many weeks a run reaches past the last week with weather."""
    if observed is None:
        return 0
    jahr, woche, _ = today.isocalendar()
    abstand = _week_distance(observed, (int(jahr), int(woche)))
    return max(0, min(abstand + lead, cap))


def _week_distance(start: tuple[int, int], end: tuple[int, int]) -> int:
    """Whole weeks between two ISO weeks, over the calendar."""
    von = date.fromisocalendar(start[0], start[1], 1)
    bis = date.fromisocalendar(end[0], end[1], 1)
    return (bis - von).days // 7


def bundle_horizons(folder: Path) -> list[set[int]]:
    """The horizons of every model in a folder.

    The list comes from ``<name>.features.json``, which final_model.py writes
    beside the bundle. Reading it needs no pickle and no LightGBM.
    """
    import json

    saetze = []
    for datei in sorted(folder.glob("*.features.json")):
        namen = json.loads(datei.read_text())
        saetze.append({int(key[1:]) for key in namen if key.startswith("h")})
    return saetze
