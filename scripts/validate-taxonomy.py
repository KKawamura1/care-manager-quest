#!/usr/bin/env python3
"""Validate imported taxonomy metadata without changing classifications or packs."""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/taxonomy"
REPORT = ROOT / "docs/taxonomy/structural-validation.json"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)


def index_unique(rows, label):
    result = {}
    for row in rows:
        key = row["id"]
        require(isinstance(key, str) and key, f"Invalid {label} ID")
        require(key not in result, f"Duplicate {label} ID: {key}")
        result[key] = row
    return result


def check_hierarchy(nodes, parent_key, label):
    for key in nodes:
        visited = set()
        current = key
        while current is not None:
            require(current in nodes, f"Missing {label} parent: {current}")
            require(current not in visited, f"Cycle in {label} hierarchy at {current}")
            visited.add(current)
            current = nodes[current].get(parent_key)


def expected_ids(first, last):
    return {f"{year}-{number:02d}" for year in range(first, last + 1)
            for number in range(1, 61)}


def validate():
    manifest = read_json(ROOT / "docs/taxonomy/import-manifest.json")
    for name, entry in manifest["files"].items():
        imported = (ROOT / entry["repositoryPath"]).read_bytes()
        require(len(imported) == entry["bytes"]
                and hashlib.sha256(imported).hexdigest() == entry["sha256"],
                f"Imported source bytes differ: {name}")
    taxonomy = read_json(DATA / "taxonomy-v2.json")
    older = read_json(DATA / "question-concepts-2005-2019.json")
    combined = read_json(DATA / "question-concepts-2005-2025-combined.json")
    supplied = read_json(DATA / "validation.json")
    categories = index_unique(taxonomy["categories"], "category")
    concepts = index_unique(taxonomy["concepts"], "concept")
    require(len(concepts) == 179, "Expected 179 common concepts")
    require(not set(categories) & set(concepts), "Category/concept ID collision")
    check_hierarchy(categories, "parentId", "category")
    check_hierarchy(concepts, "parentConceptId", "concept")
    require({key for key, row in categories.items() if row.get("parentId") is None}
            == {"A", "B", "C"}, "Expected A/B/C roots")
    for key, row in categories.items():
        if row.get("parentId") is not None:
            require(re.fullmatch(r"[ABC][0-9]+", key) is not None
                    and row["parentId"] == key[0], f"Invalid category hierarchy: {key}")
    for key, row in concepts.items():
        category = row["categoryId"]
        require(category in categories and categories[category].get("parentId") is not None,
                f"Missing or root concept category: {key}")
        require(key.startswith(category + "."), f"Concept/category ID mismatch: {key}")
        parent = row.get("parentConceptId")
        if parent is not None:
            require(concepts[parent]["categoryId"] == category,
                    f"Parent belongs to another category: {key}")

    require(set(older) == expected_ids(2005, 2019), "Historical IDs must cover 900 entries")
    require(set(combined) == expected_ids(2005, 2025), "Combined IDs must cover 1,260 entries")
    require({key: value for key, value in combined.items() if key in older} == older,
            "Historical subset changed in combined data")
    per_year = Counter()
    playable_per_year = Counter()
    for key, row in combined.items():
        require(re.fullmatch(r"20[0-9]{2}-[0-9]{2}", key) is not None,
                f"Invalid question ID: {key}")
        year, number = map(int, key.split("-"))
        primary = row["primaryConceptId"]
        require(primary in concepts, f"Missing primary concept for {key}: {primary}")
        require(row["primaryCategory"] == concepts[primary]["categoryId"],
                f"Primary concept/category mismatch: {key}")
        related = row["relatedConceptIds"]
        require(isinstance(related, list) and all(isinstance(x, str) for x in related),
                f"Related concepts must be string array: {key}")
        require(len(related) == len(set(related)), f"Duplicate related concept: {key}")
        require(primary not in related, f"Primary repeated as related: {key}")
        require(all(x in concepts for x in related), f"Dangling related concept: {key}")
        domain = ("介護支援分野" if number <= 25 else
                  "保健医療サービスの知識等" if number <= 45 else "福祉サービスの知識等")
        if year <= 2019:
            require(row["classificationRevision"] == 3, f"Wrong historical revision: {key}")
            require(row["sourceYear"] == year and row["questionNumber"] == number,
                    f"Question ID/metadata mismatch: {key}")
            require(row["officialExamDomain"] == domain, f"Wrong official domain: {key}")
            require(row["status"] in {"provisional_topic_classified",
                    "needs_option_level_review", "excluded_exam_canceled"},
                    f"Lost provisional status: {key}")
            require(row["reviewScope"] == "topic_based_not_all_options_verified"
                    and row["relatedReviewStatus"] == "selected_only_not_exhaustive",
                    f"Lost review flags: {key}")
            require(type(row["isPlayable"]) is bool and row["isPlayable"] == (key != "2005-28"),
                    f"Wrong historical playable flag: {key}")
        else:
            require(row["revision"] == 2 and row["taxonomyVersion"] == taxonomy["version"],
                    f"Wrong v2 revision/version: {key}")
            expected_status = ("editorial_draft_from_prior_manual_review" if year == 2025
                               else "editorial_draft_from_topic_metadata")
            require(row["status"] == expected_status, f"Lost v2 draft status: {key}")
            require(row["sourceExamDomain"] == domain, f"Wrong v2 official domain: {key}")
        playable = row.get("isPlayable", True)  # v2 omits this field; preserve that schema.
        require(type(playable) is bool and playable == (key != "2005-28"),
                f"Wrong playable state: {key}")
        require((row["status"] == "excluded_exam_canceled") == (key == "2005-28"),
                f"Wrong canceled status: {key}")
        per_year[str(year)] += 1
        playable_per_year[str(year)] += int(playable)
    require(all(count == 60 for count in per_year.values()), "Expected 60 entries/year")
    require(sum(playable_per_year.values()) == 1259, "Expected 1,259 playable questions")

    with (DATA / "classification-2005-2019.csv").open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    require(len(rows) == 900, "Expected 900 CSV rows")
    require(len({row["question_id"] for row in rows}) == 900, "Duplicate CSV question ID")
    require({row["question_id"] for row in rows} == set(older), "CSV/JSON coverage mismatch")
    for row in rows:
        key = row["question_id"]
        value = older[key]
        expected = {
            "exam_domain": value["officialExamDomain"],
            "primary_category": value["primaryCategory"],
            "primary_concept_id": value["primaryConceptId"],
            "primary_concept_label": concepts[value["primaryConceptId"]]["label"],
            "related_concept_ids": ";".join(value["relatedConceptIds"]),
            "review_status": value["status"],
            "playable": str(value["isPlayable"]).lower(),
        }
        require(all(row[field] == text for field, text in expected.items()),
                f"CSV/JSON classification mismatch: {key}")

    old_statuses = dict(sorted(Counter(row["status"] for row in older.values()).items()))
    old_categories = dict(sorted(Counter(row["primaryCategory"] for row in older.values()).items()))
    coverage = {
        "2005-2019_metadata": len(older),
        "2005-2019_playable": sum(row["isPlayable"] for row in older.values()),
        "all_years_2005-2025_metadata": len(combined),
        "all_years_2005-2025_playable": sum(playable_per_year.values()),
    }
    require(supplied["coverage"] == coverage, "Supplied coverage report mismatch")
    require(supplied["perYear"] == {str(y): per_year[str(y)] for y in range(2005, 2020)},
            "Supplied per-year report mismatch")
    require(supplied["byCategory2005_2019"] == old_categories, "Supplied category report mismatch")
    require(supplied["reviewQueue"] == old_statuses, "Supplied review queue mismatch")
    used = len({row["primaryConceptId"] for row in older.values()})
    require(supplied["usedConcepts2005_2019"] == used, "Supplied used-concept count mismatch")
    require(supplied["questionClassificationRevision"] == 3, "Supplied revision mismatch")
    return {
        "result": "passed",
        "coverage": coverage,
        "categories": len(categories), "concepts": len(concepts),
        "perYear": dict(sorted(per_year.items())),
        "playablePerYear": dict(sorted(playable_per_year.items())),
        "excludedQuestionIds": ["2005-28"],
        "reviewStatuses": dict(sorted(Counter(row["status"] for row in combined.values()).items())),
        "historicalSubsetUnchanged": True,
        "csvMatchesHistoricalJson": True,
        "checks": ["import_manifest_byte_fidelity", "duplicate_json_keys", "unique_category_and_concept_ids",
                   "complete_question_id_sets", "60_entries_per_year", "playable_counts",
                   "primary_and_related_references", "primary_category_consistency",
                   "unique_related_concepts", "category_and_concept_parent_references",
                   "acyclic_hierarchies", "same_category_concept_parents",
                   "official_domains_separate_from_editorial_categories", "draft_review_flags",
                   "csv_json_parity", "supplied_validation_report_parity"],
        "sha256": {path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                   for path in sorted(DATA.iterdir()) if path.suffix in {".json", ".csv"}},
        "limitations": ["Structural validation only; classification semantics not reviewed.",
                        "Question text, historical answers and legal currentness not checked.",
                        "2020-2025 v2 entries preserved from the supplied combined file; "
                        "independent v2 source not present in main.",
                        "Application integration and progress migration deferred."],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-report", action="store_true")
    args = parser.parse_args()
    try:
        result = validate()
        if args.write_report:
            REPORT.parent.mkdir(parents=True, exist_ok=True)
            REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        else:
            require(read_json(REPORT) == result, "Stored structural report differs; regenerate explicitly")
        print("PASS: 1,260 classifications / 1,259 playable / 179 concepts / 21 years")
    except (ValueError, KeyError, TypeError, OSError) as error:
        parser.exit(1, f"FAIL: {error}\n")
