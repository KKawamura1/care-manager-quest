// Typed application-facing projection of the existing normalizer.
export const ROOTS: Readonly<Record<string, string>>;
export function buildIndex(options?: { baselineOnly?: boolean }): {
  drawer_registry: {
    id: string; root: string; concept_id: string; concept_label: string;
    attribute_id: string; attribute_label: string; review_required: boolean;
    concept_resolution: string; attribute_resolution: string;
  }[];
  index: {
    proposition_id: string; canonical_question_id: string; choice_index: number; primary_drawer_id: string | null;
    classification_semantic_reviewed: boolean;
    drawer_review_required: boolean;
  }[];
};
