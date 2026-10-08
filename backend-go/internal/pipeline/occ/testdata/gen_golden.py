"""Write the inputs and golden files of the Go packages under internal/pipeline/occ.

Run from modell/ in the default dev shell (pandas, scipy, pyproj, lightgbm):
    python ../backend-go/internal/pipeline/occ/testdata/gen_golden.py
The reference functions come from modell/src/pilze. The synthetic data is seeded.
"""
from __future__ import annotations

import gzip
import io
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

OCC = Path(__file__).resolve().parents[1]
ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT / "modell" / "src" / "pilze"))

import arten_zaehlen  # noqa: E402
import build_occurrences as bo  # noqa: E402
import gbif_fetch  # noqa: E402
import visit_model  # noqa: E402

RAW = OCC / "testdata" / "raw"
TAXA = ["Boletus edulis"]

CENTRES = [(9.05, 48.52), (9.30, 48.60), (8.60, 50.10), (11.50, 48.10), (10.00, 51.00), (9.15, 48.75)]
SPECIES = ["Boletus edulis", "Imleria badia", "Cantharellus cibarius", "Macrolepiota procera",
           "Amanita muscaria", "Russula cyanoxantha", "Mycena galericulata", "Craterellus tubaeformis",
           "Xerocomellus chrysenteron", None]
UNC = [None, None, None, None, 10.0, 50, 100, 499.0, 500, 500.5, 1000, 4999, 5000, 5001, 10000]
NAMES = [f"Beobachter {i}" for i in range(30)]


def gz_write(path: Path, lines: list[str]) -> None:
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as handle:
        handle.write("".join(lines).encode("utf-8"))
    path.write_bytes(buf.getvalue())


def event_date(rng: random.Random, day: date) -> tuple[str, object]:
    kind = rng.random()
    if kind < 0.70:
        return day.isoformat(), day.day
    if kind < 0.82:
        return f"{day.isoformat()}T{rng.randint(6, 18):02d}:{rng.randint(0, 59):02d}:00", day.day
    if kind < 0.88:
        # An offset just after midnight moves the UTC date back by one day.
        return f"{day.isoformat()}T00:30:00+02:00", day.day
    if kind < 0.92:
        return f"{day.isoformat()}/{(day + timedelta(days=2)).isoformat()}", None
    if kind < 0.96:
        return day.strftime("%Y-%m"), None
    return day.isoformat(), None


def walk_day(rng: random.Random) -> date:
    year = rng.randint(2013, 2026)
    start = date(year, 1, 1)
    span = (date(2026, 9, 30) - start).days if year == 2026 else 364
    # A season bias puts most walks into late summer and autumn.
    offset = int(min(span, max(0, rng.gauss(260, 50)))) if rng.random() < 0.8 else rng.randint(0, span)
    return start + timedelta(days=min(offset, span))


def make_records() -> list[dict]:
    rng = random.Random(7)
    out = []
    gid = 4_000_000_000
    fixed_days = [date(2014, 12, 29), date(2016, 1, 1), date(2020, 12, 31), date(2021, 1, 3), date(2026, 9, 27)]
    for w in range(720):
        day = fixed_days[w] if w < len(fixed_days) else walk_day(rng)
        name = rng.choice(NAMES) if rng.random() > 0.05 else None
        lon0, lat0 = rng.choice(CENTRES)
        lon0 += rng.gauss(0, 0.15)
        lat0 += rng.gauss(0, 0.10)
        unc = rng.choice(UNC)
        n = rng.choice([1, 1, 2, 2, 3, 4, 5, 6])
        species = rng.sample(SPECIES, k=n)
        for sp in species:
            gid += rng.randint(1, 9)
            ev, d = event_date(rng, day)
            klass = "Agaricomycetes"
            r = rng.random()
            if r < 0.05:
                klass = "Lecanoromycetes"
            elif r < 0.09:
                klass = "Pezizomycetes"
            elif r < 0.10:
                klass = None
            out.append({
                "gbifID": str(gid), "datasetKey": "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
                "license": "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
                "kingdom": "Fungi", "phylum": "Basidiomycota", "class": klass,
                "species": sp, "speciesKey": 5000 + SPECIES.index(sp),
                "decimalLatitude": round(lat0 + rng.gauss(0, 0.002), 6),
                "decimalLongitude": round(lon0 + rng.gauss(0, 0.003), 6),
                "coordinateUncertaintyInMeters": unc,
                "eventDate": ev, "year": day.year, "month": day.month, "day": d,
                "issues": [], "recordedByHash": gbif_fetch.hash_observer(name),
            })
    return out


def write_raw(records: list[dict]) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for old in RAW.glob("*.jsonl.gz"):
        old.unlink()
    files: dict[str, list[str]] = {}
    for rec in records:
        year, month = rec["year"], rec["month"]
        name = f"fungi_de_{year}-{month:02d}.jsonl.gz" if year == 2024 else f"fungi_de_{year}.jsonl.gz"
        files.setdefault(name, []).append(json.dumps(rec, ensure_ascii=False) + "\n")
    for name, lines in files.items():
        gz_write(RAW / name, lines)


def app_finds() -> list[dict]:
    rng = random.Random(11)
    items = []
    for i in range(16):
        lon, lat = rng.choice(CENTRES)
        items.append({"id": f"3f2b-{i:04d}", "speciesId": "a1",
                      "scientificName": "Boletus edulis" if i % 3 else "Imleria badia",
                      "lat": round(lat + rng.gauss(0, 0.05), 6), "lon": round(lon + rng.gauss(0, 0.05), 6),
                      "foundOn": (date(2025, 8, 1) + timedelta(days=rng.randint(0, 400))).isoformat(),
                      "count": None})
    return items


def build(app_path: Path) -> pd.DataFrame:
    """build_occurrences.main without argparse and the parquet write."""
    frame = bo.read_raw(RAW)
    frame["basis"] = bo.GBIF
    app = bo.read_app(app_path)
    if not app.empty:
        frame = pd.concat([frame, app], ignore_index=True)
    frame = frame[~frame["class"].isin(bo.LICHEN_CLASSES)]
    frame = frame[frame["class"] == bo.TARGET_CLASS].copy()
    frame = bo.add_time(frame)
    error = frame["coordinateUncertaintyInMeters"]
    frame = frame[error.isna() | (error <= 5000.0)].copy()
    return bo.add_grid(frame)


def nan_none(v):
    if v is None:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    return v


def occ_rows(frame: pd.DataFrame) -> list[dict]:
    return [{
        "gbifID": str(r.gbifID), "species": nan_none(r.species), "observer": nan_none(r.recordedByHash),
        "basis": r.basis, "lat": float(r.decimalLatitude), "lon": float(r.decimalLongitude),
        "unc": nan_none(float(r.coordinateUncertaintyInMeters)) if r.coordinateUncertaintyInMeters is not None else None,
        "date": r.date.date().isoformat(), "iso_year": int(r.iso_year), "iso_week": int(r.iso_week),
        "doy": int(r.doy), "x": float(r.x), "y": float(r.y), "cell": r.cell,
    } for r in frame.itertuples(index=False)]


def visits_golden(occ: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, list[dict]]:
    sel = occ[occ["iso_year"] >= 2015]
    error = sel["coordinateUncertaintyInMeters"]
    sel = sel[error.isna() | (error <= 500.0)]
    visits = visit_model.build_visits(sel, ",".join(TAXA), 2)
    rows = [{
        "key": r.visit, "n_records": int(r.n_records), "n_species": int(r.n_species),
        "label": int(r.label), "from_app": int(r.from_app), "lon": float(r.lon), "lat": float(r.lat),
        "x": float(r.x), "y": float(r.y), "cell": r.cell, "date": r.date.date().isoformat(),
        "iso_year": int(r.iso_year), "iso_week": int(r.iso_week),
    } for r in visits.itertuples(index=False)]
    return sel, visits, rows


def activity_golden(sel: pd.DataFrame, visits: pd.DataFrame) -> dict:
    fields = visit_model.ActivityFields(sel, TAXA)
    rng = random.Random(5)
    xs = list(visits["x"]) + [fields.x0 * 25000 - 40000.0, (fields.x0 + 3) * 25000 + 12345.0, 4_300_000.0]
    ys = list(visits["y"]) + [fields.y0 * 25000 - 1000.0, (fields.y0 + 2) * 25000 + 999.0, 2_900_000.0]
    day0 = fields.day0.date()
    dates = [d.date() for d in visits["date"]] + [day0 - timedelta(days=3), day0 + timedelta(days=fields.n_days + 40),
                                                 day0 + timedelta(days=fields.n_days // 2)]
    for _ in range(40):
        xs.append(fields.x0 * 25000 + rng.uniform(-30000, 260000))
        ys.append(fields.y0 * 25000 + rng.uniform(-30000, 300000))
        dates.append(day0 + timedelta(days=rng.randint(-20, fields.n_days + 30)))
    stamps = pd.Series(pd.to_datetime([d.isoformat() for d in dates]))
    stamps.iloc[-1] = pd.NaT
    out = {"x0": fields.x0, "y0": fields.y0, "day0": day0.isoformat(), "n_days": fields.n_days,
           "xs": [float(v) for v in xs], "ys": [float(v) for v in ys],
           "dates": [None if pd.isna(s) else s.date().isoformat() for s in stamps], "horizons": {}}
    for h in (0, 1, 2, 3, 4):
        sampled = fields.sample(np.asarray(xs), np.asarray(ys), stamps, h)
        out["horizons"][str(h)] = {c: [None if np.isnan(v) else float(v) for v in sampled[c]] for c in sampled.columns}
    return out


def season_golden(occ: pd.DataFrame) -> tuple[bytes, list]:
    besuche = arten_zaehlen.begehungen_bilden(occ)
    stand = arten_zaehlen.letzte_volle_woche(besuche["date"].max().date())
    table = arten_zaehlen.saisontabelle(besuche, stand=stand)
    text = json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n"
    cases = [date(2026, 8, 23), date(2026, 8, 24), date(2026, 8, 30), date(2020, 12, 31),
             date(2021, 1, 3), date(2021, 1, 4), date(2015, 12, 31), date(2016, 1, 3)]
    weeks = [[d.isoformat(), *arten_zaehlen.letzte_volle_woche(d)] for d in cases]
    return text.encode("utf-8"), weeks


EVENT_DATES = [
    "2021-09-12", "2021-09-12T10:00:00", "2021-09-12T23:30:00+02:00", "2021-09-12T01:00:00+02:00",
    "2021-09-12T01:00:00-05:00", "2021-09-12T10:00Z", "2021-09", "2021", "2021-09-12/2021-09-13",
    "2021-09-12 10:00:00", "2021-09-12T10", "2021-09-12T10:00:00.123", "2021-09-12T01:00:00+0200",
    "2021-09-12T01:00+02", "20210912", "2021-9-12", "2021-02-30", "", "garbage", "2021-09-12T24:00:00",
    "2021-09-12T10:00:00.123456789Z", "1899-12-31", "2021-09-12T00:30:00+01:00", "2021/09/12",
    "2021-09-12T10:00:00 +02:00", "2021-W37", "2021-255", "2021-09-12T1:00:00", " 2021-09-12",
    "2021.09.12", "2021 09 12", "2021\\09\\12", "2021-09-12T10:00:00.1234567", "2021-09-12T10:0",
    "2021-09-12T1", "2021-09-12T10:00:00+2", "2021-09-12T10:00:00+02:3", "2021-09-12T10:00:00Zjunk",
    "2021-09-12T10:00:00 Z", "2021-09-12 ", "2021-09-12T", "202109", "2021-0912", "2021-09-12T1000",
    "2021-09-12T100000", "2021-09-12T23:00:00-02:00", "2021-12-31T23:30:00-01:00",
    "2021-09-12T10:00:00+24:00", "2021-09-12T10:00:00+0260", "2021-09-1", "2021-9",
    "2021-09-12T10:00:00.", "0000-01-01", "1677-09-21", "1677-09-22", "2262-04-11", "2263-01-01",
    "-2021-09-12", "2021-09-12\t", "2021-09-12T10:00:00Z ", "2021-09-12T10:00:00+02:00 ",
    "2021-09-12T10:00:00 +02", "2021-09-12T10:00:5", "2021-09-12T10:00:60", "NaT",
    "2021-09-12T10:00:00+0", "2021-09-12T10:00:00+", "2021-09-12T10:00:00.123+05:30",
    "2021-01-01T00:00:00+05:30", "2020-02-29", "2021-02-29", "2021-13-01", "2021-00-10", "2021-09-00",
    "2021-09-12T10:00:00z", "2021-09-12t10:00", "2021-09-12T10:00:00 +02:00 junk", "2021-09-12T25",
    "2021-09-12T10:00:00.1234567890123456789", "2021-09-12T10:00:00.123456789012345678",
]


def event_dates_golden() -> list:
    out = []
    for c in EVENT_DATES:
        r = pd.to_datetime(pd.Series([c, "2020-01-01"]), format="ISO8601", errors="coerce",
                           utc=True).dt.tz_localize(None).dt.normalize()[0]
        out.append([c, None if pd.isna(r) else r.date().isoformat()])
    return out


def observers_golden() -> dict:
    import hashlib
    gbif_values = ["Anna Muster", "  Anna MUSTER ", "İstanbul Pilz", "Ärger Öl", "\x1cX\x1f",
                   ["a", "b"], {"b": 1, "a": "xä"}, 5, 2.5, True, "", None, [], 0, "  "]
    app_ids = ["", "a", "abc", "3f2b-0001", "x" * 63, "x" * 64, "y" * 65, "z" * 200,
               "6f1c3a2e-9b7d-4e21-8a55-0c3d2b1e4f60"]
    return {
        "hash_observer": [[v, gbif_fetch.hash_observer(v)] for v in gbif_values],
        "observer_hash": [[i, bo.observer_hash(i)] for i in app_ids],
        "blake2s_32": [[i, hashlib.blake2s(i.encode()).hexdigest()] for i in app_ids],
        "slim_lines": [json.dumps(gbif_fetch.slim(r), ensure_ascii=False) + "\n" for r in (
            {"gbifID": "1", "key": 1, "recordedBy": "Anna", "decimalLatitude": 48.5, "year": 2024,
             "issues": ["A"], "extra": {"x": 1}, "species": "B\u00e4r", "elevation": 1e-05,
             "coordinateUncertaintyInMeters": 30.0, "individualCount": 12345678901234},
            {"gbifID": "2", "recordedBy": None},
            {"gbifID": "3", "recordedBy": ["Anna", "Bert"], "eventDate": "2024-01-02/2024-01-03"})],
    }


def main() -> None:
    records = make_records()
    write_raw(records)
    app_path = OCC / "testdata" / "app_finds.json"
    app_path.write_text(json.dumps({"items": app_finds()}, indent=1) + "\n", encoding="utf-8")

    occ = build(app_path)
    (OCC / "testdata" / "occurrences.json").write_text(json.dumps(occ_rows(occ)) + "\n")
    occ.to_parquet(OCC / "testdata" / "occurrences.parquet", index=False)

    sel, visits, rows = visits_golden(occ)
    (OCC / "visits" / "testdata").mkdir(parents=True, exist_ok=True)
    (OCC / "visits" / "testdata" / "visits.json").write_text(json.dumps(rows) + "\n")

    (OCC / "activity" / "testdata").mkdir(parents=True, exist_ok=True)
    (OCC / "activity" / "testdata" / "activity.json").write_text(json.dumps(activity_golden(sel, visits)) + "\n")

    text, weeks = season_golden(occ)
    (OCC / "season" / "testdata").mkdir(parents=True, exist_ok=True)
    (OCC / "season" / "testdata" / "saison.json").write_bytes(text)
    (OCC / "season" / "testdata" / "weeks.json").write_text(json.dumps(weeks) + "\n")

    (OCC / "testdata" / "eventdates.json").write_text(json.dumps(event_dates_golden(), ensure_ascii=False) + "\n")
    (OCC / "testdata" / "observers.json").write_text(json.dumps(observers_golden(), ensure_ascii=False) + "\n")
    print(f"records {len(records)}, occurrences {len(occ)}, visits {len(rows)}, positives {int(visits['label'].sum())}")


if __name__ == "__main__":
    main()
