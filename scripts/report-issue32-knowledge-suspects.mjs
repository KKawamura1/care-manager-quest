#!/usr/bin/env node
/**
 * Non-destructive queue of POSSIBLE context-biased knowledge classifications.
 * Does not rewrite any classifications and does not treat keyword matches as proof.
 * Usage: node scripts/report-issue32-knowledge-suspects.mjs [--json] [--limit=N]
 */
import { loadYear } from './issue32-revisions.mjs';

const rules = [
  {
    id: 'medical-subject-but-provider-requirement',
    reason: '健康・病態ではなくサービスの人員／報酬／運営基準かもしれない',
    test: (r, text, root) => root === '1' && /(?:指定|介護予防|訪問看護|通所介護|訪問リハビリ|居宅療養管理指導|事業所).{0,32}(?:義務|指定|管理者|算定|支給|人員|報酬|実施|提供|配置|連絡|記録)/.test(text)
  },
  {
    id: 'technique-but-provider-obligation',
    reason: '汎用支援技法でなく特定サービスの法定義務・記録・加算の可能性',
    test: (r, text, root) => root === '2' &&
      /(?:指定.{0,30}事業者|介護予防支援|居宅介護支援|訪問リハビリ|通所リハビリ|施設サービス計画|介護報酬).{0,60}(?:義務|加算|算定|指定|記録|交付|保存|出席|開催|届け|実施しなければ)/.test(text)
  },
  {
    id: 'disease-but-policy-or-institution',
    reason: '疾病名が登場するだけで制度・施策・機関の属性かもしれない',
    test: (r, text, root) => root === '1' &&
      /(?:認知症初期集中支援チーム|認知症地域支援推進員|認知症ケアパス|認知症施策|自立支援医療|高齢者虐待|障害年金|障害福祉サービス|地域包括支援センター|推進計画)/.test(text)
  },
  {
    id: 'provider-but-general-method',
    reason: '施設やサービスの名称は題材であり、実際は一般的な支援方法かもしれない',
    test: (r, text, root) => root === '3' &&
      /(?:相談した|勧めた|提案した|助言した|選ぶ|選択するよう|残存能力|理解できる言葉|本人の意思|自己決定|アセスメントの結果)/.test(text)
  },
  {
    id: 'not-system-but-benefit-procedure',
    reason: '資源・ケア方法ではなく給付資格や他制度調整の可能性',
    test: (r, text, root) => root !== '4' &&
      /(?:住所地特例|保険料徴収|介護保険給付.*(?:対象|限度|支給)|住宅改修費.*(?:支給|給付)|財政安定化基金|保険給付の対象外)/.test(text)
  }
];

const limitText = process.argv.find((x) => x.startsWith('--limit='));
const limit = limitText ? Number(limitText.slice(8)) : 50;
if (!Number.isInteger(limit) || limit < 1) throw new Error('Use --limit=positive-integer');
const counts = Object.fromEntries(rules.map((x) => [x.id, 0]));
const items = [];
let reviewedSkipped = 0;
for (let year = 2005; year <= 2025; year++) {
  for (const row of loadYear(year)) {
    if (row.knowledge_target_review?.principle === 'judgment_knowledge_over_context') {
      reviewedSkipped++;
      continue;
    }
    const text = row.proposition ?? '';
    const root = row.primary_path?.[0] ?? null;
    const flags = rules.filter((rule) => rule.test(row, text, root));
    if (!flags.length) continue;
    for (const flag of flags) counts[flag.id]++;
    items.push({
      question_id: row.question_id,
      choice_index: row.choice_index,
      proposition_index: row.proposition_index,
      question_stem: row.question_stem,
      proposition: text,
      current_root: root,
      subject_concept: row.subject_concept,
      attribute: row.attribute,
      flags: flags.map(({ id, reason }) => ({ id, reason })),
      caveat: '要意味レビュー。語句一致だけでは誤分類と断定できない。'
    });
  }
}
const output = {
  summary: { candidate_count: items.length, already_judgment_reviewed_skipped: reviewedSkipped, flag_counts: counts,
    note: '候補には正しい既存分類・真偽未確認の記述も含む。ソース照合前に自動的にassignedにしない。' },
  candidates: items.slice(0, limit)
};
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
} else {
  console.log('Potential context-biased classifications: ' + items.length +
    ' (already reviewed skipped: ' + reviewedSkipped + ')');
  for (const [rule, count] of Object.entries(counts)) console.log(rule + ': ' + count);
  for (const row of output.candidates) {
    console.log(row.question_id + '/' + row.choice_index + '/' + row.proposition_index +
      ' ' + row.flags.map((x) => x.id).join(',') + '\n  ' + row.proposition.slice(0, 160));
  }
}
