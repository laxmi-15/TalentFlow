#!/usr/bin/env python3
"""
TalentFlow Anomaly Injection & Detection Evaluation Engine
==========================================================
Evaluates the 5 mandatory business anomaly scenarios against synthetic data:
  1. Candidate advances without required review
  2. Interviewer double-booked
  3. Offer exceeds compensation band
  4. Withdrawn application remains scheduled
  5. Irrelevant scorecard criterion

Verifies:
  - Baseline dataset: Zero False Positives (FPR = 0.0)
  - Injected dataset: Precision >= 0.95, Recall >= 0.90, F1 >= 0.92
  - Outputs ground_truth.json, detected_anomalies.json, and evaluation_report.json
"""

from __future__ import annotations

import argparse
import copy
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import pandas as pd

RUBRIC_KEYS = {"technical", "problem", "communication", "collaboration", "values"}


# ── Detector Implementation ───────────────────────────────────────────────────

def detect_anomalies(data_dir: Path) -> list[dict[str, Any]]:
    """Runs deterministic rule-based detectors over the given dataset directory."""
    anomalies: list[dict[str, Any]] = []

    # Load dataframes
    reqs_df = pd.read_csv(data_dir / "requisitions.csv")
    apps_df = pd.read_csv(data_dir / "applications.csv")
    intvs_df = pd.read_csv(data_dir / "interviews.csv")
    scs_df = pd.read_csv(data_dir / "scorecards.csv")
    offers_df = pd.read_csv(data_dir / "offers.csv")

    # 1. Candidate advances without required review
    # Candidates in 'Offer' or 'Hired' must have at least one submitted scorecard if they had an interview
    apps_with_interviews = set(intvs_df["application_id"].dropna())
    apps_with_scorecards = set(scs_df["application_id"].dropna())
    
    advanced_apps = apps_df[apps_df["stage"].isin(["Offer", "Hired"])]
    for _, app in advanced_apps.iterrows():
        app_id = app["business_id"]
        # If application reached Offer/Hired, it must have had interview + scorecard review
        if app_id in apps_with_interviews and app_id not in apps_with_scorecards:
            anomalies.append({
                "scenario": "unreviewed_advancement",
                "record_type": "Application",
                "record_id": app_id,
                "detail": f"Application {app_id} advanced to {app['stage']} without submitted scorecards.",
            })

    # 2. Interviewer double-booked
    # Interviews overlapping for the same interviewer
    sc_intv_map = scs_df.groupby("interview_id")["interviewer_id"].unique().to_dict()
    # Check interviews
    intv_records = intvs_df[intvs_df["status"].isin(["Scheduled", "Completed"])].to_dict("records")
    for i in range(len(intv_records)):
        i1 = intv_records[i]
        ivrs_1 = set(sc_intv_map.get(i1["business_id"], []))
        s1 = datetime.fromisoformat(i1["start_at"])
        e1 = datetime.fromisoformat(i1["end_at"])

        for j in range(i + 1, len(intv_records)):
            i2 = intv_records[j]
            ivrs_2 = set(sc_intv_map.get(i2["business_id"], []))
            common_ivrs = ivrs_1.intersection(ivrs_2)
            if not common_ivrs:
                continue

            s2 = datetime.fromisoformat(i2["start_at"])
            e2 = datetime.fromisoformat(i2["end_at"])

            # Check overlap: (StartA < EndB) and (EndA > StartB)
            if s1 < e2 and e1 > s2:
                anomalies.append({
                    "scenario": "interviewer_double_booked",
                    "record_type": "Interview",
                    "record_id": i1["business_id"],
                    "conflicting_record_id": i2["business_id"],
                    "interviewer_id": list(common_ivrs)[0],
                    "detail": f"Interviewer {list(common_ivrs)[0]} double booked on {i1['business_id']} and {i2['business_id']}.",
                })

    # 3. Offer exceeds compensation band
    req_bands = dict(zip(reqs_df["business_id"], zip(reqs_df["band_min"], reqs_df["band_max"])))
    app_req_map = dict(zip(apps_df["business_id"], apps_df["requisition_id"]))

    for _, off in offers_df.iterrows():
        app_id = off["application_id"]
        req_id = app_req_map.get(app_id)
        if req_id and req_id in req_bands:
            b_min, b_max = req_bands[req_id]
            base = float(off["base"])
            if base > float(b_max):
                anomalies.append({
                    "scenario": "offer_exceeds_band",
                    "record_type": "Offer",
                    "record_id": off["business_id"],
                    "detail": f"Offer {off['business_id']} base {base} exceeds max {b_max} for req {req_id}.",
                })

    # 4. Withdrawn application remains scheduled
    withdrawn_apps = set(apps_df[apps_df["stage"] == "Withdrawn"]["business_id"])
    for _, intv in intvs_df.iterrows():
        if intv["application_id"] in withdrawn_apps and intv["status"] == "Scheduled":
            anomalies.append({
                "scenario": "withdrawn_app_scheduled",
                "record_type": "Interview",
                "record_id": intv["business_id"],
                "application_id": intv["application_id"],
                "detail": f"Interview {intv['business_id']} still scheduled for withdrawn application {intv['application_id']}.",
            })

    # 5. Irrelevant scorecard criterion
    for _, sc in scs_df.iterrows():
        try:
            ratings = json.loads(sc["ratings_json"])
            invalid_keys = set(ratings.keys()) - RUBRIC_KEYS
            if invalid_keys:
                anomalies.append({
                    "scenario": "irrelevant_criterion",
                    "record_type": "Scorecard",
                    "record_id": sc["business_id"],
                    "detail": f"Scorecard {sc['business_id']} contains unapproved criteria: {invalid_keys}.",
                })
        except Exception:
            pass

    return anomalies


# ── Anomaly Injector ──────────────────────────────────────────────────────────

def inject_anomalies(baseline_dir: Path, target_dir: Path, seed: int = 20261022) -> list[dict[str, Any]]:
    """Copies baseline dataset and injects deterministic anomalies, writing ground_truth.json."""
    rng = random.Random(seed)
    target_dir.mkdir(parents=True, exist_ok=True)

    # Copy files
    for p in baseline_dir.glob("*.csv"):
        (target_dir / p.name).write_bytes(p.read_bytes())

    reqs_df = pd.read_csv(target_dir / "requisitions.csv")
    apps_df = pd.read_csv(target_dir / "applications.csv")
    intvs_df = pd.read_csv(target_dir / "interviews.csv")
    scs_df = pd.read_csv(target_dir / "scorecards.csv")
    offers_df = pd.read_csv(target_dir / "offers.csv")

    ground_truth: list[dict[str, Any]] = []

    # Scenario 1: Candidate advances without review (inject 5 cases)
    # Pick 5 applications in Interview stage, change their stage directly to Offer, ensuring no scorecards exist
    intv_apps = set(intvs_df["application_id"].dropna())
    eligible_s1 = apps_df[apps_df["business_id"].isin(intv_apps) & (apps_df["stage"] == "Interview")]
    s1_samples = eligible_s1.sample(min(5, len(eligible_s1)), random_state=seed)
    for _, app in s1_samples.iterrows():
        app_id = app["business_id"]
        # Remove any existing scorecards for this app
        scs_df = scs_df[scs_df["application_id"] != app_id]
        apps_df.loc[apps_df["business_id"] == app_id, "stage"] = "Offer"
        ground_truth.append({
            "scenario": "unreviewed_advancement",
            "record_type": "Application",
            "record_id": app_id,
            "label": "Candidate advanced without review",
        })

    # Scenario 2: Interviewer double-booked (inject 5 cases)
    # Force two interviews for the same interviewer to have overlapping start_at/end_at
    if len(scs_df) >= 10:
        sample_scs = scs_df.sample(5, random_state=seed)
        for _, sc in sample_scs.iterrows():
            ivr_id = sc["interviewer_id"]
            intv_id = sc["interview_id"]
            # Find or create a second interview overlapping this one
            intv_row = intvs_df[intvs_df["business_id"] == intv_id]
            if not intv_row.empty:
                s_at = intv_row.iloc[0]["start_at"]
                e_at = intv_row.iloc[0]["end_at"]
                # Pick another interview and assign it same time and add a scorecard for same ivr
                other_intvs = intvs_df[intvs_df["business_id"] != intv_id]
                if not other_intvs.empty:
                    target_intv = other_intvs.iloc[rng.randint(0, len(other_intvs) - 1)]
                    intvs_df.loc[intvs_df["business_id"] == target_intv["business_id"], "start_at"] = s_at
                    intvs_df.loc[intvs_df["business_id"] == target_intv["business_id"], "end_at"] = e_at
                    # Add scorecard linking same interviewer to target_intv
                    new_sc_row = {
                        "business_id": f"SCORE-ANOM-{target_intv['business_id']}-{ivr_id}",
                        "interview_id": target_intv["business_id"],
                        "interviewer_id": ivr_id,
                        "application_id": target_intv["application_id"],
                        "recommendation": "Yes",
                        "notes": "Anomaly injected scorecard",
                        "ratings_json": json.dumps({"technical": 4, "problem": 4}),
                        "submitted_at": e_at,
                    }
                    scs_df = pd.concat([scs_df, pd.DataFrame([new_sc_row])], ignore_index=True)
                    ground_truth.append({
                        "scenario": "interviewer_double_booked",
                        "record_type": "Interview",
                        "record_id": intv_id,
                        "conflicting_record_id": target_intv["business_id"],
                        "interviewer_id": ivr_id,
                        "label": "Interviewer double booked",
                    })

    # Scenario 3: Offer exceeds compensation band (inject 5 cases)
    if len(offers_df) >= 5:
        sample_offers = offers_df.sample(5, random_state=seed)
        for _, off in sample_offers.iterrows():
            off_id = off["business_id"]
            exceeded_base = float(off["band_max"]) + rng.randint(20000, 45000)
            offers_df.loc[offers_df["business_id"] == off_id, "base"] = exceeded_base
            ground_truth.append({
                "scenario": "offer_exceeds_band",
                "record_type": "Offer",
                "record_id": off_id,
                "label": "Offer exceeds band",
            })

    # Scenario 4: Withdrawn application remains scheduled (inject 5 cases)
    # Pick 5 scheduled interviews, set their application to Withdrawn
    sched_intvs = intvs_df[intvs_df["status"] == "Scheduled"]
    if len(sched_intvs) >= 5:
        sample_sched = sched_intvs.sample(5, random_state=seed)
        for _, intv in sample_sched.iterrows():
            app_id = intv["application_id"]
            apps_df.loc[apps_df["business_id"] == app_id, "stage"] = "Withdrawn"
            ground_truth.append({
                "scenario": "withdrawn_app_scheduled",
                "record_type": "Interview",
                "record_id": intv["business_id"],
                "application_id": app_id,
                "label": "Withdrawn application interview scheduled",
            })

    # Scenario 5: Irrelevant scorecard criterion (inject 5 cases)
    if len(scs_df) >= 5:
        sample_scs5 = scs_df.sample(5, random_state=seed + 1)
        for _, sc in sample_scs5.iterrows():
            sc_id = sc["business_id"]
            try:
                ratings = json.loads(sc["ratings_json"])
            except Exception:
                ratings = {"technical": 3}
            ratings["unapproved_metric_aesthetic"] = 5
            scs_df.loc[scs_df["business_id"] == sc_id, "ratings_json"] = json.dumps(ratings)
            ground_truth.append({
                "scenario": "irrelevant_criterion",
                "record_type": "Scorecard",
                "record_id": sc_id,
                "label": "Scorecard with unapproved criterion",
            })

    # Write modified files
    reqs_df.to_csv(target_dir / "requisitions.csv", index=False)
    apps_df.to_csv(target_dir / "applications.csv", index=False)
    intvs_df.to_csv(target_dir / "interviews.csv", index=False)
    scs_df.to_csv(target_dir / "scorecards.csv", index=False)
    offers_df.to_csv(target_dir / "offers.csv", index=False)

    gt_file = target_dir / "ground_truth.json"
    gt_file.write_text(json.dumps(ground_truth, indent=2))
    pd.DataFrame(ground_truth).to_csv(target_dir / "ground_truth.csv", index=False)
    print(f"  Injected {len(ground_truth)} anomalies into {target_dir}")
    return ground_truth


# ── Evaluator ─────────────────────────────────────────────────────────────────

def evaluate(baseline_dir: Path, target_dir: Path) -> dict[str, Any]:
    print("\n🔍 Evaluating Anomaly Detector Performance...")

    # 1. Clean baseline evaluation (must have 0 False Positives)
    print("  Testing baseline dataset (clean)...")
    baseline_detections = detect_anomalies(baseline_dir)
    print(f"  Baseline detections: {len(baseline_detections)} (Expected: 0)")

    # 2. Injected dataset evaluation
    print("  Testing injected dataset...")
    injected_detections = detect_anomalies(target_dir)
    gt_path = target_dir / "ground_truth.json"
    ground_truth = json.loads(gt_path.read_text())

    # Build sets using canonical incident identifiers
    def incident_key(item: dict[str, Any]) -> tuple:
        sc = item["scenario"]
        if sc == "interviewer_double_booked":
            r1 = item.get("record_id", "")
            r2 = item.get("conflicting_record_id", "")
            pair = tuple(sorted([r1, r2]))
            return (sc, pair)
        return (sc, item.get("record_id", ""))

    gt_set = {incident_key(gt) for gt in ground_truth}
    det_set = {incident_key(d) for d in injected_detections}

    tp = len(gt_set.intersection(det_set))
    fp = len(det_set - gt_set)
    fn = len(gt_set - det_set)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    # Per scenario breakdown
    scenarios = [
        "unreviewed_advancement",
        "interviewer_double_booked",
        "offer_exceeds_band",
        "withdrawn_app_scheduled",
        "irrelevant_criterion",
    ]
    per_scenario = {}
    for sc in scenarios:
        s_gt = {r for (s, r) in gt_set if s == sc}
        s_det = {r for (s, r) in det_set if s == sc}
        s_tp = len(s_gt.intersection(s_det))
        s_fp = len(s_det - s_gt)
        s_fn = len(s_gt - s_det)
        s_prec = s_tp / (s_tp + s_fp) if (s_tp + s_fp) > 0 else 0.0
        s_rec = s_tp / (s_tp + s_fn) if (s_tp + s_fn) > 0 else 0.0
        s_f1 = (2 * s_prec * s_rec) / (s_prec + s_rec) if (s_prec + s_rec) > 0 else 0.0
        per_scenario[sc] = {
            "ground_truth_count": len(s_gt),
            "detected_count": len(s_det),
            "true_positives": s_tp,
            "false_positives": s_fp,
            "false_negatives": s_fn,
            "precision": round(s_prec, 4),
            "recall": round(s_rec, 4),
            "f1": round(s_f1, 4),
        }

    report = {
        "baseline_false_positives": len(baseline_detections),
        "overall_metrics": {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "meets_criteria": (
                len(baseline_detections) == 0
                and precision >= 0.95
                and recall >= 0.90
                and f1 >= 0.92
            ),
        },
        "per_scenario": per_scenario,
    }

    report_path = target_dir / "evaluation_report.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(f"\n📊 Evaluation Results:")
    print(f"   Baseline FP: {report['baseline_false_positives']}")
    print(f"   Precision  : {precision:.4f} (target >= 0.95)")
    print(f"   Recall     : {recall:.4f} (target >= 0.90)")
    print(f"   F1 Score   : {f1:.4f} (target >= 0.92)")
    print(f"   Meets criteria: {report['overall_metrics']['meets_criteria']}")
    return report


def main():
    parser = argparse.ArgumentParser(description="TalentFlow Anomaly Evaluator")
    parser.add_argument("--baseline", default="./output_full")
    parser.add_argument("--anomalies-out", default="./output_anomalies")
    args = parser.parse_args()

    baseline_dir = Path(args.baseline)
    anom_dir = Path(args.anomalies_out)

    if not (baseline_dir / "applications.csv").exists():
        print(f"❌ Error: Baseline directory {baseline_dir} not found or missing CSVs.")
        sys.exit(1)

    print("\n⚡ Step 1: Injecting deterministic anomalies...")
    inject_anomalies(baseline_dir, anom_dir)

    print("\n⚡ Step 2: Evaluating detector...")
    evaluate(baseline_dir, anom_dir)


if __name__ == "__main__":
    main()

