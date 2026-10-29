"""
TalentFlow Data Engine & Anomaly Detector Test Suite
=====================================================
Run via:
  python -m unittest test_data_engine.py
or
  pytest test_data_engine.py
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path
import pandas as pd

DATA_ENGINE_DIR = Path(__file__).parent
OUTPUT_FULL = DATA_ENGINE_DIR / "output_full"
OUTPUT_FULL_2 = DATA_ENGINE_DIR / "output_full_2"
OUTPUT_ANOMALIES = DATA_ENGINE_DIR / "output_anomalies"


class TestTalentFlowDataEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.has_full = (OUTPUT_FULL / "applications.csv").exists()
        cls.has_full_2 = (OUTPUT_FULL_2 / "applications.csv").exists()
        cls.has_anom = (OUTPUT_ANOMALIES / "evaluation_report.json").exists()

    def test_01_full_profile_counts(self):
        """Verifies exact target counts: 200 reqs, 5000 cands, 8000 apps, 2000 interviews."""
        if not self.has_full:
            self.skipTest("output_full not found")

        reqs = pd.read_csv(OUTPUT_FULL / "requisitions.csv")
        cands = pd.read_csv(OUTPUT_FULL / "candidates.csv")
        apps = pd.read_csv(OUTPUT_FULL / "applications.csv")
        intvs = pd.read_csv(OUTPUT_FULL / "interviews.csv")

        self.assertEqual(len(reqs), 200, f"Expected 200 reqs, got {len(reqs)}")
        self.assertEqual(len(cands), 5000, f"Expected 5000 cands, got {len(cands)}")
        self.assertEqual(len(apps), 8000, f"Expected 8000 apps, got {len(apps)}")
        self.assertEqual(len(intvs), 2000, f"Expected 2000 interviews, got {len(intvs)}")

    def test_02_business_id_formats(self):
        """Verifies ID formats conform to the specification."""
        if not self.has_full:
            self.skipTest("output_full not found")

        req_re = re.compile(r"^REQ-\d{4}-\d{6}$")
        cand_re = re.compile(r"^CAND-\d{6}$")
        app_re = re.compile(r"^APP-CAND-\d{6}-REQ-\d{4}-\d{6}$")
        int_re = re.compile(r"^INT-\d{4}-\d{6}$")
        sc_re = re.compile(r"^SCORE-INT-\d{4}-\d{6}-USR-\d{6}$")
        off_re = re.compile(r"^OFF-\d{4}-\d{6}$")

        reqs = pd.read_csv(OUTPUT_FULL / "requisitions.csv")
        for bid in reqs["business_id"].head(50):
            self.assertTrue(req_re.match(bid), f"Invalid REQ ID: {bid}")

        cands = pd.read_csv(OUTPUT_FULL / "candidates.csv")
        for bid in cands["business_id"].head(50):
            self.assertTrue(cand_re.match(bid), f"Invalid CAND ID: {bid}")

        apps = pd.read_csv(OUTPUT_FULL / "applications.csv")
        for bid in apps["business_id"].head(50):
            self.assertTrue(app_re.match(bid), f"Invalid APP ID: {bid}")

        intvs = pd.read_csv(OUTPUT_FULL / "interviews.csv")
        for bid in intvs["business_id"].head(50):
            self.assertTrue(int_re.match(bid), f"Invalid INT ID: {bid}")

        scs = pd.read_csv(OUTPUT_FULL / "scorecards.csv")
        for bid in scs["business_id"].head(50):
            self.assertTrue(sc_re.match(bid), f"Invalid SCORE ID: {bid}")

        offers = pd.read_csv(OUTPUT_FULL / "offers.csv")
        for bid in offers["business_id"].head(50):
            self.assertTrue(off_re.match(bid), f"Invalid OFF ID: {bid}")

    def test_03_deterministic_reproducibility(self):
        """Verifies identical SHA-256 checksums across independent runs."""
        if not (self.has_full and self.has_full_2):
            self.skipTest("output_full or output_full_2 not found")

        m1 = json.loads((OUTPUT_FULL / "generation_manifest.json").read_text())
        m2 = json.loads((OUTPUT_FULL_2 / "generation_manifest.json").read_text())

        for file_name, hash1 in m1["checksums"].items():
            hash2 = m2["checksums"].get(file_name)
            self.assertEqual(hash1, hash2, f"Hash mismatch on {file_name}: {hash1} != {hash2}")

    def test_04_anomaly_detector_performance(self):
        """Verifies anomaly detector meets all target accuracy thresholds."""
        if not self.has_anom:
            self.skipTest("output_anomalies/evaluation_report.json not found")

        report = json.loads((OUTPUT_ANOMALIES / "evaluation_report.json").read_text())
        overall = report["overall_metrics"]

        self.assertEqual(report["baseline_false_positives"], 0, "Baseline FP must be 0")
        self.assertGreaterEqual(overall["precision"], 0.95, f"Precision {overall['precision']} < 0.95")
        self.assertGreaterEqual(overall["recall"], 0.90, f"Recall {overall['recall']} < 0.90")
        self.assertGreaterEqual(overall["f1_score"], 0.92, f"F1 {overall['f1_score']} < 0.92")
        self.assertTrue(overall["meets_criteria"], "Target acceptance criteria must be True")


if __name__ == "__main__":
    unittest.main()

