/** Facets recovered from explicit classification metadata, not truth judgments.
 * Rules are scoped by concept. Multiple possible facets remain review targets. */
type AttributeRule = readonly [conceptId: string, pattern: RegExp | null, id: string, label: string];
type AttributeMetadata = { attribute?: string | null };
type ConceptRef = { id: string; root: string };
const rules: AttributeRule[] = [
  ['4.1.certification', /認定調査|基本調査|一次判定|基準時間/, 'survey', '認定調査・一次判定'],
  ['4.1.certification', /主治医意見書|医学的管理の必要性|医学的留意事項/, 'physician_opinion', '主治医意見書の記載・利用'],
  ['4.1.certification', /認定審査会|二次判定|審査判定/, 'committee', '認定審査会・二次判定'],
  ['4.1.certification', /有効期間|認定の効力/, 'validity', '認定の有効期間・効力'],
  ['4.1.certification', /認定申請|申請代行|変更申請/, 'application', '認定申請・変更手続'],
  ['4.1.certification', /特定疾病/, 'specific_diseases', '第2号被保険者の特定疾病'],
  ['4.1.certification.opinion', /記載項目|記載事項|医学的管理|医学的留意事項|中核症状欄/, 'documentation', '記載・情報管理'],
  ['2.3.service_meeting', /開催|出席|意見聴取/, 'meeting', '開催・参加・意見聴取'],
  ['2.3.monitoring', /確認|評価|記録/, 'monitoring', 'モニタリング・評価'],
  ['2.1', /尊厳|自立|自己決定|基本姿勢/, 'ethical', '支援原則・倫理'],
  ['2.2.group', /集団援助の対象と実践例/, 'practice', '実践方法'],
  ['2.2.community', /地域援助の対象と実践例/, 'practice', '実践方法'],
];
const broad = /申請・調査・審査判定・有効期間|アセスメント・計画・調整・評価|疾病・症状・検査・治療|給付の対象・条件・限度・負担|目的・主体・対象・手続|目的・対象・給付|対象・人員・提供・運営|施設固有の人員・設備・運営・サービス|対象・提供内容・運営基準|設置・人員・機能・業務|計画・調整・会議・評価/;

export function reviewedAttribute(row: AttributeMetadata, _path: readonly string[], concept: ConceptRef) {
  const metadata = String(row.attribute ?? '').normalize('NFKC').replace(/\s+/g, '');
  if (!metadata || broad.test(metadata)) return null;
  const hits = rules.filter(([id, pattern]) => id === concept.id && pattern?.test(metadata));
  // Explicit domain facets shared across concepts.
  if (concept.root === '1') {
    if (/感染経路/.test(metadata)) hits.push([concept.id, null, 'transmission', '感染経路']);
    if (/原因|危険因子|リスク|発症要因/.test(metadata)) hits.push([concept.id, null, 'risk', '原因・危険因子']);
    if (/病態|合併症|有病率|初期症状|徴候/.test(metadata)) hits.push([concept.id, null, 'symptoms', '病態・症状']);
  }
  if (concept.root === '4') {
    if (/制度の対象・要件|加入・資格/.test(metadata)) hits.push([concept.id, null, 'eligibility', '対象・要件']);
    if (/制度上の目的/.test(metadata)) hits.push([concept.id, null, 'principles', '目的・理念・基本方針']);
    if (/制度上の機能|設置可能な主体|機能・業務|委託|義務と努力の内容/.test(metadata)) hits.push([concept.id, null, 'authority', '役割・権限・責務']);
    if (/取消し・効力停止/.test(metadata)) hits.push([concept.id, null, 'designation', '指定・監督']);
    if (/滞納者への給付制限/.test(metadata)) hits.push([concept.id, null, 'benefit_restriction', '滞納時の給付制限']);
  }
  const distinct = new Map(hits.map(([, , id, label]) => [id, label]));
  if (!distinct.size) return null;
  const [id, label] = [...distinct][0];
  return { id, label, resolution: distinct.size === 1 ? 'curated' : 'inferred',
    evidence: 'explicit_attribute', candidate_attribute_ids: [...distinct.keys()] };
}
