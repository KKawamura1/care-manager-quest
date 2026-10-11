import assert from 'node:assert/strict';
import { canonicalQuestionId, canonicalPropositionId, inspectPath, observedPathId, buildIndex } from './normalize-issue32-ids.mjs';

const row2020 = { year: 2020, question_number: 1, question_id: 'care_manager_2020_001', choice_index: 2, proposition_index: 1 };
assert.equal(canonicalQuestionId(row2020), '2020-01');
assert.equal(canonicalPropositionId(row2020), '2020-01/c2/p1');
assert.equal(canonicalQuestionId({ ...row2020, question_number: 60, question_id: 'care_manager_2020_060' }), '2020-60');
assert.equal(canonicalQuestionId({ year: 2019, question_number: 1, question_id: '2019-01' }), '2019-01');
assert.throws(() => canonicalQuestionId({ ...row2020, question_id: 'care_manager_2020_002' }));
assert.throws(() => canonicalQuestionId({ ...row2020, year: 2019 }));
assert.throws(() => canonicalPropositionId({ ...row2020, choice_index: 6 }));

const changedMeaning = inspectPath(['1', '人の健康と生活', '1.2', '生活機能']);
assert.equal(changedMeaning.taxonomy_v1_1_anchor_id, '1');
assert.equal(changedMeaning.taxonomy_v1_1_exact_node_id, null);
assert.ok(changedMeaning.v1_1_conflicts.some((x) => x.code === '1.2'));

const matching = inspectPath(['3', '支援の提供体制', '3.1', '介護保険サービス・施設', '3.1.facilities', '施設サービス']);
assert.equal(matching.taxonomy_v1_1_anchor_id, '3.1.facilities');
assert.equal(matching.taxonomy_v1_1_exact_node_id, '3.1.facilities');
assert.deepEqual(matching.v1_1_conflicts, []);

const proposed = inspectPath(['4', '社会保障の仕組み', '社会保険一般', '保険者の主体']);
assert.equal(proposed.taxonomy_v1_1_anchor_id, '4');
assert.equal(proposed.taxonomy_v1_1_exact_node_id, null);
assert.equal(observedPathId(['1', '人の健康と生活']), observedPathId(['1', '人の健康と生活']));
assert.notEqual(observedPathId(['1', '人の健康と生活']), observedPathId(['2', '支援の考え方と方法']));

const { index, summary, question_aliases, path_registry } = buildIndex();
assert.equal(index.length, summary.proposition_count);
assert.equal(new Set(index.map((x) => x.proposition_id)).size, index.length);
assert.equal(question_aliases.length, 60);
assert.equal(new Set(path_registry.map((x) => x.id)).size, path_registry.length);
assert.ok(index.some((x) => x.source_question_id === 'care_manager_2020_001' && x.canonical_question_id === '2020-01'));
assert.ok(index.some((x) => x.canonical_question_id === '2025-60' && x.primary_path_id));
console.log('issue32 ID tests passed', summary);
