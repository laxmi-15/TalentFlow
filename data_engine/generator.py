#!/usr/bin/env python3
"""
TalentFlow Synthetic Data Generator
====================================
CLI: python generator.py --seed 20261022 --profile full --out ./output

Profiles:
  starter : 20 req, 500 cand, 800 app, 200 interviews
  full    : 200 req, 5000 cand, 8000 app, 2000 interviews

Output (all files written to --out dir):
  requisitions.csv, candidates.csv, applications.csv, interviews.csv,
  scorecards.csv, offers.csv, approvals.csv, stage_events.csv,
  generation_manifest.json, checksums.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from faker import Faker

GENERATOR_VERSION = "1.0.0"
SEED = 20261022

# ── Profiles ──────────────────────────────────────────────────────────────────

PROFILES: dict[str, dict[str, int]] = {
    "starter": {
        "requisitions": 20,
        "hiring_managers": 5,
        "candidates": 500,
        "applications": 800,
        "interviews": 200,
        "interviewers": 10,
        "panels": 3,
    },
    "full": {
        "requisitions": 200,
        "hiring_managers": 50,
        "candidates": 5000,
        "applications": 8000,
        "interviews": 2000,
        "interviewers": 80,
        "panels": 20,
    },
}

# ── Constants ─────────────────────────────────────────────────────────────────

DEPARTMENTS = [
    "Engineering", "Design", "Analytics", "Sales", "People",
    "Security", "Finance", "Marketing", "Product", "Legal",
]
LOCATIONS = ["Remote", "Pune", "Berlin", "Austin", "Lisbon", "Singapore", "Toronto"]
SOURCES = ["Referral", "CareerssSite", "Agency", "JobBoard", "Campus"]
SKILLS = [
    "TypeScript", "Python", "SQL", "Figma", "Negotiation", "Kubernetes",
    "Research", "Excel", "Leadership", "Security", "React", "Java",
    "Go", "Rust", "Data Modelling", "Product Strategy", "Hiring",
]
ROLES_DATA: list[tuple[str, str, int, int]] = [
    ("Senior Backend Engineer", "Engineering", 130000, 175000),
    ("Product Designer", "Design", 95000, 135000),
    ("Data Analyst", "Analytics", 80000, 115000),
    ("Account Executive", "Sales", 90000, 140000),
    ("People Partner", "People", 85000, 120000),
    ("Security Engineer", "Engineering", 140000, 190000),
    ("Frontend Engineer", "Engineering", 110000, 155000),
    ("Product Manager", "Product", 120000, 165000),
    ("Data Engineer", "Analytics", 115000, 160000),
    ("Marketing Manager", "Marketing", 90000, 130000),
]

STAGES = ["Applied", "Screen", "Interview", "Final", "Offer", "Hired", "Withdrawn"]
STAGE_WEIGHTS = [0.25, 0.20, 0.20, 0.15, 0.10, 0.07, 0.03]

REQ_STATUSES = ["Draft", "PendingApproval", "Open", "Closed", "Rejected"]
REQ_STATUS_WEIGHTS = [0.05, 0.10, 0.65, 0.15, 0.05]

RUBRIC_KEYS = ["technical", "problem", "communication", "collaboration", "values"]

ANCHOR_NOW = datetime(2026, 10, 22, 12, 0, 0, tzinfo=timezone.utc)
NOW = ANCHOR_NOW
BASE_DATE = NOW - timedelta(days=365)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def rand_date(start: datetime, end: datetime, rng: random.Random) -> datetime:
    delta = int((end - start).total_seconds())
    if delta <= 0:
        return start
    return start + timedelta(seconds=rng.randint(0, delta))


def next_business_day(dt: datetime) -> datetime:
    while dt.weekday() >= 5:
        dt += timedelta(days=1)
    return dt


# ── Business ID helpers ───────────────────────────────────────────────────────

def make_bid_gen(prefix: str, year: int | None = None):
    counter = [0]

    def gen() -> str:
        counter[0] += 1
        if year:
            return f"{prefix}-{year}-{counter[0]:06d}"
        return f"{prefix}-{counter[0]:06d}"

    return gen


# ── Generator ─────────────────────────────────────────────────────────────────

class TalentFlowGenerator:
    def __init__(self, seed: int, profile: str, out_dir: Path):
        self.seed = seed
        self.profile = profile
        self.out_dir = out_dir
        self.cfg = PROFILES[profile]
        self.rng = random.Random(seed)
        self.fake = Faker()
        Faker.seed(seed)
        self.year = NOW.year

        # ID generators
        self._req_id = make_bid_gen("REQ", self.year)
        self._cand_id = make_bid_gen("CAND")
        self._int_id = make_bid_gen("INT", self.year)
        self._off_id = make_bid_gen("OFF", self.year)
        self._apr_id = make_bid_gen("APR")
        self._usr_id = make_bid_gen("USR")
        self._pnl_id = make_bid_gen("PNL")

        out_dir.mkdir(parents=True, exist_ok=True)

    def pick(self, lst: list) -> Any:
        return self.rng.choice(lst)

    def pickw(self, lst: list, weights: list) -> Any:
        return self.rng.choices(lst, weights=weights, k=1)[0]

    def generate(self) -> dict[str, pd.DataFrame]:
        print(f"  Generating {self.profile} profile (seed={self.seed})...")
        dfs: dict[str, pd.DataFrame] = {}

        dfs["users"] = self._gen_users()
        dfs["hiring_managers"] = self._gen_hiring_managers(dfs["users"])
        dfs["interviewers"] = self._gen_interviewers(dfs["users"])
        dfs["availability"] = self._gen_availability(dfs["interviewers"])
        dfs["panels"] = self._gen_panels()
        dfs["panel_members"] = self._gen_panel_members(dfs["panels"], dfs["interviewers"])
        dfs["requisitions"] = self._gen_requisitions(dfs["hiring_managers"])
        dfs["skill_requirements"] = self._gen_skill_requirements(dfs["requisitions"])
        dfs["candidates"] = self._gen_candidates()
        dfs["applications"] = self._gen_applications(dfs["candidates"], dfs["requisitions"])
        dfs["stage_events"] = self._gen_stage_events(dfs["applications"], dfs["users"])
        dfs["interviews"] = self._gen_interviews(dfs["applications"], dfs["panels"], dfs["interviewers"])
        dfs["scorecards"] = self._gen_scorecards(dfs["interviews"])
        dfs["offers"] = self._gen_offers(dfs["applications"], dfs["requisitions"])
        dfs["approvals"] = self._gen_approvals(dfs["requisitions"], dfs["offers"], dfs["users"])

        return dfs

    def _gen_users(self) -> pd.DataFrame:
        n = max(self.cfg["hiring_managers"] + self.cfg["interviewers"] + 10, 20)
        roles = (
            ["Admin"] * 2
            + ["Recruiter"] * 4
            + ["HiringManager"] * self.cfg["hiring_managers"]
            + ["Interviewer"] * self.cfg["interviewers"]
            + ["Approver"] * 3
        )
        rows = []
        for i, role in enumerate(roles[:n]):
            name = self.fake.name()
            email = f"{name.split()[0].lower()}{i}@example.test"
            rows.append({
                "business_id": self._usr_id(),
                "name": name,
                "email": email,
                "role": role,
                "active": True,
                "password_hash": "$2b$12$placeholder_hash_for_synthetic_data",
                "created_at": iso(rand_date(BASE_DATE, NOW - timedelta(days=100), self.rng)),
            })
        return pd.DataFrame(rows)

    def _gen_hiring_managers(self, users: pd.DataFrame) -> pd.DataFrame:
        hm_users = users[users["role"] == "HiringManager"].copy()
        rows = []
        for _, u in hm_users.iterrows():
            rows.append({
                "user_id": u["business_id"],
                "department": self.pick(DEPARTMENTS),
                "created_at": u["created_at"],
            })
        return pd.DataFrame(rows)

    def _gen_interviewers(self, users: pd.DataFrame) -> pd.DataFrame:
        ivr_users = users[users["role"] == "Interviewer"].copy()
        rows = []
        for _, u in ivr_users.iterrows():
            rows.append({
                "user_id": u["business_id"],
                "team": self.pick(DEPARTMENTS),
                "created_at": u["created_at"],
            })
        return pd.DataFrame(rows)

    def _gen_availability(self, interviewers: pd.DataFrame) -> pd.DataFrame:
        rows = []
        for _, ivr in interviewers.iterrows():
            for day in range(5):
                for block in range(3):
                    rows.append({
                        "interviewer_id": ivr["user_id"],
                        "day_of_week": day,
                        "block": block,
                        "free": self.rng.random() > 0.35,
                    })
        return pd.DataFrame(rows)

    def _gen_panels(self) -> pd.DataFrame:
        n = self.cfg["panels"]
        focus_opts = [
            "System design, scalability", "Code review, architecture",
            "Portfolio, visual craft", "Domain knowledge, research",
            "Pipeline, negotiation", "Technical depth, algorithms",
        ]
        rows = []
        for _ in range(n):
            rows.append({
                "business_id": self._pnl_id(),
                "name": f"{self.pick(DEPARTMENTS)} Panel — {self.fake.catch_phrase()[:30]}",
                "focus": self.pick(focus_opts),
                "created_at": iso(rand_date(BASE_DATE, NOW - timedelta(days=90), self.rng)),
            })
        return pd.DataFrame(rows)

    def _gen_panel_members(self, panels: pd.DataFrame, interviewers: pd.DataFrame) -> pd.DataFrame:
        ivr_ids = interviewers["user_id"].tolist()
        rows = []
        for _, p in panels.iterrows():
            members = self.rng.sample(ivr_ids, min(3, len(ivr_ids)))
            for m in members:
                rows.append({"panel_id": p["business_id"], "interviewer_id": m})
        return pd.DataFrame(rows)

    def _gen_requisitions(self, hiring_managers: pd.DataFrame) -> pd.DataFrame:
        n = self.cfg["requisitions"]
        hm_ids = hiring_managers["user_id"].tolist()
        rows = []
        for _ in range(n):
            role_data = self.pick(ROLES_DATA)
            title, dept, band_min, band_max = role_data
            created = rand_date(BASE_DATE, NOW - timedelta(days=10), self.rng)
            status = self.pickw(REQ_STATUSES, REQ_STATUS_WEIGHTS)
            rows.append({
                "business_id": self._req_id(),
                "title": title,
                "department": dept,
                "location": self.pick(LOCATIONS),
                "hiring_manager_id": self.pick(hm_ids),
                "headcount": self.rng.randint(1, 4),
                "status": status,
                "band_min": band_min,
                "band_max": band_max,
                "created_at": iso(created),
                "updated_at": iso(created + timedelta(days=self.rng.randint(0, 30))),
            })
        return pd.DataFrame(rows)

    def _gen_skill_requirements(self, requisitions: pd.DataFrame) -> pd.DataFrame:
        rows = []
        for _, req in requisitions.iterrows():
            n_skills = self.rng.randint(2, 5)
            skills = self.rng.sample(SKILLS, n_skills)
            for skill in skills:
                rows.append({
                    "requisition_id": req["business_id"],
                    "skill": skill,
                    "required": self.rng.random() > 0.3,
                    "min_years": self.rng.randint(1, 5) if self.rng.random() > 0.5 else None,
                })
        return pd.DataFrame(rows)

    def _gen_candidates(self) -> pd.DataFrame:
        n = self.cfg["candidates"]
        rows = []
        for i in range(n):
            name = self.fake.name()
            email = f"{name.split()[0].lower()}{i}@example.test"
            rows.append({
                "business_id": self._cand_id(),
                "name": name,
                "email": email,
                "phone": f"+1-555-{self.rng.randint(1000,9999)}-{self.rng.randint(1000,9999)}",
                "location": self.pick(LOCATIONS),
                "source": self.pick(SOURCES),
                "experience_years": self.rng.randint(0, 20),
                "skills": json.dumps(self.rng.sample(SKILLS, self.rng.randint(2, 6))),
                "created_at": iso(rand_date(BASE_DATE, NOW, self.rng)),
                "updated_at": iso(rand_date(BASE_DATE, NOW, self.rng)),
            })
        return pd.DataFrame(rows)

    def _gen_applications(self, candidates: pd.DataFrame, requisitions: pd.DataFrame) -> pd.DataFrame:
        open_reqs = requisitions[requisitions["status"] == "Open"]["business_id"].tolist()
        if not open_reqs:
            open_reqs = requisitions["business_id"].tolist()
        n = min(self.cfg["applications"], len(candidates) * len(open_reqs))
        cand_ids = candidates["business_id"].tolist()
        used_pairs: set[tuple[str, str]] = set()
        rows = []
        attempts = 0
        while len(rows) < n and attempts < n * 3:
            attempts += 1
            cand_id = self.pick(cand_ids)
            req_id = self.pick(open_reqs)
            if (cand_id, req_id) in used_pairs:
                continue
            used_pairs.add((cand_id, req_id))
            stage = self.pickw(STAGES[:-1], STAGE_WEIGHTS[:-1])
            cand_row = candidates[candidates["business_id"] == cand_id].iloc[0]
            created = rand_date(
                datetime.fromisoformat(cand_row["created_at"]),
                NOW - timedelta(days=1), self.rng,
            )
            rows.append({
                "business_id": f"APP-{cand_id}-{req_id}",
                "candidate_id": cand_id,
                "requisition_id": req_id,
                "stage": stage,
                "score": round(self.rng.uniform(40, 98), 2),
                "source": cand_row["source"],
                "created_at": iso(created),
                "updated_at": iso(created + timedelta(days=self.rng.randint(0, 45))),
            })
        return pd.DataFrame(rows)

    def _gen_stage_events(self, applications: pd.DataFrame, users: pd.DataFrame) -> pd.DataFrame:
        user_ids = users["business_id"].tolist()
        stage_order = ["Applied", "Screen", "Interview", "Final", "Offer", "Hired"]
        rows = []
        for _, app in applications.iterrows():
            stage = app["stage"]
            if stage == "Withdrawn":
                target_idx = self.rng.randint(0, 3)
            else:
                target_idx = stage_order.index(stage) if stage in stage_order else 0
            created = datetime.fromisoformat(app["created_at"])
            prev_stage = None
            for i in range(target_idx + 1):
                s = stage_order[i]
                event_time = created + timedelta(days=i * self.rng.randint(2, 10))
                rows.append({
                    "application_id": app["business_id"],
                    "from_stage": prev_stage,
                    "to_stage": s,
                    "actor_id": self.pick(user_ids),
                    "reason": None,
                    "created_at": iso(event_time),
                })
                prev_stage = s
            if app["stage"] == "Withdrawn":
                event_time = created + timedelta(days=target_idx * 5 + self.rng.randint(1, 5))
                rows.append({
                    "application_id": app["business_id"],
                    "from_stage": prev_stage,
                    "to_stage": "Withdrawn",
                    "actor_id": self.pick(user_ids),
                    "reason": "Candidate withdrew",
                    "created_at": iso(event_time),
                })
        return pd.DataFrame(rows)

    def _gen_interviews(
        self, applications: pd.DataFrame, panels: pd.DataFrame, interviewers: pd.DataFrame
    ) -> pd.DataFrame:
        offer_hired = applications[applications["stage"].isin(["Offer", "Hired"])]
        intv_final = applications[applications["stage"].isin(["Interview", "Final"])]

        n = self.cfg["interviews"]
        sample_apps = offer_hired.to_dict("records")
        rem = n - len(sample_apps)
        if rem > 0:
            sample_apps += intv_final.sample(min(rem, len(intv_final)), random_state=self.seed).to_dict("records")

        sample_apps = sample_apps[:n]
        panel_ids = panels["business_id"].tolist()
        ivr_ids = interviewers["user_id"].tolist()
        ivr_schedule: dict[str, list[tuple[datetime, datetime]]] = {ivr: [] for ivr in ivr_ids}
        self.intv_interviewers_map: dict[str, list[str]] = {}

        rows = []
        for app in sample_apps:
            is_advanced = app["stage"] in ["Offer", "Hired"]
            created_dt = datetime.fromisoformat(app["created_at"])

            if is_advanced:
                start = rand_date(created_dt + timedelta(days=2), NOW - timedelta(days=3), self.rng)
                status = "Completed"
            else:
                start = rand_date(created_dt + timedelta(days=2), NOW + timedelta(days=14), self.rng)
                status = "Completed" if start < (NOW - timedelta(hours=2)) else "Scheduled"

            start = next_business_day(start.replace(hour=self.rng.choice([9, 10, 11, 14, 15]), minute=0, second=0, microsecond=0))
            duration_min = self.rng.choice([45, 60, 90])
            end = start + timedelta(minutes=duration_min)

            free_ivrs = [
                ivr for ivr in ivr_ids
                if not any(max(start, s) < min(end, e) for s, e in ivr_schedule[ivr])
            ]
            if not free_ivrs:
                for shift in range(1, 15):
                    shift_start = start + timedelta(days=shift)
                    shift_start = next_business_day(shift_start)
                    shift_end = shift_start + timedelta(minutes=duration_min)
                    if is_advanced and shift_end >= NOW:
                        continue
                    free_ivrs = [
                        ivr for ivr in ivr_ids
                        if not any(max(shift_start, s) < min(shift_end, e) for s, e in ivr_schedule[ivr])
                    ]
                    if free_ivrs:
                        start, end = shift_start, shift_end
                        break

            if not free_ivrs:
                free_ivrs = sorted(ivr_ids, key=lambda i: len(ivr_schedule[i]))[:3]

            chosen_ivrs = self.rng.sample(free_ivrs, min(2, len(free_ivrs)))
            for ivr in chosen_ivrs:
                ivr_schedule[ivr].append((start, end))

            int_id = self._int_id()
            self.intv_interviewers_map[int_id] = chosen_ivrs

            rows.append({
                "business_id": int_id,
                "application_id": app["business_id"],
                "panel_id": self.pick(panel_ids),
                "title": self.pick(["Technical deep dive", "Panel interview", "System design review", "Behavioural interview"]),
                "start_at": iso(start),
                "end_at": iso(end),
                "status": status,
                "original_start_at": None,
                "cancel_reason": None,
                "created_at": iso(start - timedelta(days=self.rng.randint(1, 5))),
                "updated_at": iso(start),
            })
        return pd.DataFrame(rows)

    def _gen_scorecards(self, interviews: pd.DataFrame) -> pd.DataFrame:
        completed = interviews[interviews["status"] == "Completed"]
        rows = []
        for _, intv in completed.iterrows():
            int_id = intv["business_id"]
            assigned_ivrs = self.intv_interviewers_map.get(int_id, [])
            for ivr in assigned_ivrs:
                submitted_at = datetime.fromisoformat(intv["end_at"]) + timedelta(hours=self.rng.randint(1, 24))
                sc_id = f"SCORE-{int_id}-{ivr}"
                ratings = {k: self.rng.randint(3, 5) for k in RUBRIC_KEYS}
                rows.append({
                    "business_id": sc_id,
                    "interview_id": int_id,
                    "interviewer_id": ivr,
                    "application_id": intv["application_id"],
                    "recommendation": self.pick(["StrongYes", "Yes", "Yes"]),
                    "notes": self.fake.paragraph(nb_sentences=2),
                    "ratings_json": json.dumps(ratings),
                    "submitted_at": iso(submitted_at),
                })
        return pd.DataFrame(rows)

    def _gen_offers(self, applications: pd.DataFrame, requisitions: pd.DataFrame) -> pd.DataFrame:
        eligible = applications[applications["stage"].isin(["Offer", "Hired"])]
        req_map = dict(zip(requisitions["business_id"], zip(requisitions["band_min"], requisitions["band_max"])))
        rows = []
        used_apps: set[str] = set()
        for _, app in eligible.iterrows():
            if app["business_id"] in used_apps:
                continue
            used_apps.add(app["business_id"])
            req_id = app["requisition_id"]
            if req_id not in req_map:
                continue
            band_min, band_max = req_map[req_id]
            base = round(self.rng.uniform(float(band_min), float(band_max)) / 500) * 500
            off_id = self._off_id()
            rows.append({
                "business_id": off_id,
                "application_id": app["business_id"],
                "base": base,
                "bonus_pct": round(self.rng.uniform(5, 20), 1),
                "band_min": float(band_min),
                "band_max": float(band_max),
                "status": self.pick(["PendingApproval", "Approved", "Sent", "Rejected"]),
                "out_of_band": False,
                "created_at": iso(rand_date(BASE_DATE, NOW, self.rng)),
                "updated_at": iso(rand_date(BASE_DATE, NOW, self.rng)),
            })
        return pd.DataFrame(rows)

    def _gen_approvals(
        self, requisitions: pd.DataFrame, offers: pd.DataFrame, users: pd.DataFrame
    ) -> pd.DataFrame:
        user_ids = users["business_id"].tolist()
        approvers = users[users["role"].isin(["Approver", "Admin"])]["business_id"].tolist()
        rows = []
        # Requisition approvals
        pending_reqs = requisitions[requisitions["status"] == "PendingApproval"]
        for _, req in pending_reqs.iterrows():
            rows.append({
                "business_id": self._apr_id(),
                "subject_type": "Requisition",
                "subject_id": req["business_id"],
                "subject_label": f"{req['business_id']} — {req['title']}",
                "requested_by_id": self.pick(user_ids),
                "approver_id": None,
                "status": "Pending",
                "reason": None,
                "created_at": req["created_at"],
                "decided_at": None,
            })
        # Offer approvals
        pending_offers = offers[offers["status"].isin(["PendingApproval"])]
        for _, off in pending_offers.iterrows():
            rows.append({
                "business_id": self._apr_id(),
                "subject_type": "Offer",
                "subject_id": off["business_id"],
                "subject_label": f"Offer {off['business_id']}",
                "requested_by_id": self.pick(user_ids),
                "approver_id": None,
                "status": "Pending",
                "reason": None,
                "created_at": off["created_at"],
                "decided_at": None,
            })
        # Decided approvals (historical)
        approved_reqs = requisitions[requisitions["status"].isin(["Open", "Rejected"])]
        for _, req in approved_reqs.sample(min(10, len(approved_reqs)), random_state=self.seed).iterrows():
            decision = "Approved" if req["status"] == "Open" else "Rejected"
            decided_at = rand_date(
                datetime.fromisoformat(req["created_at"]) + timedelta(days=1),
                NOW, self.rng
            )
            rows.append({
                "business_id": self._apr_id(),
                "subject_type": "Requisition",
                "subject_id": req["business_id"],
                "subject_label": f"{req['business_id']} — {req['title']}",
                "requested_by_id": self.pick(user_ids),
                "approver_id": self.pick(approvers) if approvers else None,
                "status": decision,
                "reason": "Approved per headcount plan" if decision == "Approved" else "Budget freeze",
                "created_at": req["created_at"],
                "decided_at": iso(decided_at),
            })
        return pd.DataFrame(rows)

    def save(self, dfs: dict[str, pd.DataFrame]) -> dict[str, str]:
        """Write CSV files and return checksums."""
        checksums: dict[str, str] = {}
        for name, df in dfs.items():
            path = self.out_dir / f"{name}.csv"
            # Stable sort for determinism
            if "business_id" in df.columns:
                df = df.sort_values("business_id")
            elif "created_at" in df.columns:
                df = df.sort_values("created_at")
            df.to_csv(path, index=False)
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            checksums[name] = sha
            print(f"    {name}.csv: {len(df)} rows (sha256={sha[:12]}...)")
        return checksums

    def write_manifest(self, dfs: dict[str, pd.DataFrame], checksums: dict[str, str]) -> None:
        import faker as faker_pkg
        import pandas as pandas_pkg
        import numpy as numpy_pkg

        try:
            from importlib.metadata import version as get_version
            faker_ver = get_version("faker")
        except Exception:
            faker_ver = getattr(faker_pkg, "__version__", "26.0.0")

        manifest = {
            "generator_version": GENERATOR_VERSION,
            "seed": self.seed,
            "profile": self.profile,
            "generated_at": iso(NOW),
            "dependency_versions": {
                "faker": faker_ver,
                "pandas": getattr(pandas_pkg, "__version__", "unknown"),
                "numpy": getattr(numpy_pkg, "__version__", "unknown"),
                "python": sys.version.split()[0],
            },
            "row_counts": {name: len(df) for name, df in dfs.items()},
            "checksums": checksums,
        }
        manifest_path = self.out_dir / "generation_manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2))
        print(f"\n  Manifest: {manifest_path}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="TalentFlow Synthetic Data Generator")
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--profile", choices=["starter", "full"], default="starter")
    parser.add_argument("--out", default="./output")
    args = parser.parse_args()

    out_dir = Path(args.out)
    print(f"\n🌱 TalentFlow Data Generator v{GENERATOR_VERSION}")
    print(f"   seed={args.seed}  profile={args.profile}  out={out_dir.resolve()}\n")

    gen = TalentFlowGenerator(seed=args.seed, profile=args.profile, out_dir=out_dir)
    dfs = gen.generate()
    print("\n📂 Saving CSV files...")
    checksums = gen.save(dfs)
    gen.write_manifest(dfs, checksums)
    print("\n✅ Generation complete!")
    print(f"   Output dir: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
