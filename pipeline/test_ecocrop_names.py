"""Tests for pipeline/build_ecocrop_names.py (offline, made-up rows in the CSV's own column names).

Run from the repo root:  python3 -m unittest discover -s pipeline -v
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_ecocrop_names as b  # noqa: E402

CROPS_JSON = Path(__file__).resolve().parents[1] / "mobile" / "assets" / "data" / "crops.json"


def row(code: str, sci: str, comname: str) -> dict:
    return {"EcoPortCode": code, "ScientificName": sci, "COMNAME": comname}


SWEET_POTATO = row("1265", "Ipomoea batatas", "batata, camote, kamote, sweet potato (Engl), Camote")
CASSAVA = row("1420", "Manihot esculenta", "cassava, manioc, tapioca plant")


class SplitNamesTests(unittest.TestCase):
    def test_split_names_drops_parentheses_and_duplicates(self):
        self.assertEqual(
            b.split_names("green gram (India), mung bean (Aust), Mung Bean, , judia"),
            ["green gram", "mung bean", "judia"],
        )

    def test_split_names_keeps_names_past_the_twelfth(self):
        # Ecocrop lists names A-Z, so "okra" is the 40th of 54 names for Abelmoschus esculentus.
        names = [f"name {i:02d}" for i in range(39)] + ["okra"]
        self.assertEqual(b.split_names(", ".join(names))[-1], "okra")
        self.assertEqual(len(b.split_names(", ".join(names))), 40)

    def test_split_names_collapses_spaces_and_stray_quotes(self):
        self.assertEqual(b.split_names("  sweet   potato ,bende'"), ["sweet potato", "bende"])


class BuildIndexTests(unittest.TestCase):
    def test_library_rows_leave_species_and_merge_names(self):
        index = b.build_index([SWEET_POTATO, CASSAVA], {"sweet-potato": ["1265"]}, "2026-11-14")
        lib = index["library"]["sweet-potato"]
        self.assertEqual(lib["sci"], "Ipomoea batatas")
        self.assertEqual(lib["names"], ["batata", "camote", "kamote", "sweet potato"])
        self.assertEqual([s["code"] for s in index["species"]], ["1420"])
        self.assertEqual(index["meta"]["species_count"], 1)
        self.assertEqual(index["meta"]["credit"], "Crop names: FAO Ecocrop © FAO, via OpenCLIM/ecocrop")
        self.assertEqual(index["meta"]["retrieved"], "2026-11-14")

    def test_all_mapped_codes_of_a_crop_merge_names(self):
        rows = [row("1574", "Oryza sativa", "rice, arroz"), row("8143", "Oryza sativa var. x", "paddy, rice")]
        index = b.build_index(rows, {"lowland-rice": ["1574", "8143"]}, "2026-11-14")
        self.assertEqual(index["library"]["lowland-rice"], {"sci": "Oryza sativa", "names": ["rice", "arroz", "paddy"]})
        self.assertEqual(index["species"], [])

    def test_unknown_mapped_code_raises(self):
        with self.assertRaisesRegex(ValueError, "99999"):
            b.build_index([CASSAVA], {"corn": ["99999"]}, "2026-11-14")

    def test_species_without_common_name_is_kept(self):
        index = b.build_index([row("7", "Abc def", "")], {}, "2026-11-14")
        self.assertEqual(index["species"], [{"code": "7", "sci": "Abc def", "names": []}])

    def test_species_are_sorted_by_scientific_name_and_rows_without_one_are_skipped(self):
        index = b.build_index([CASSAVA, row("8", "", "no name"), row("9", "Abelmoschus esculentus", "okra")], {}, "x")
        self.assertEqual([s["sci"] for s in index["species"]], ["Abelmoschus esculentus", "Manihot esculenta"])

    def test_every_library_crop_is_mapped(self):
        crops = json.loads(CROPS_JSON.read_text(encoding="utf-8"))["crops"]
        self.assertEqual(set(b.MAPPING), {c["id"] for c in crops})


if __name__ == "__main__":
    unittest.main()
