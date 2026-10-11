/**
 * Reusable knowledge drawers for Issue #32.
 *
 * Original proposition text, source paths and ambiguity flags remain immutable.
 * This is an explicit normalization of (knowledge concept, testable attribute),
 * NOT a statement that the underlying propositions are correct.
 */
import { createHash } from 'node:crypto';

const norm = (value) => String(value ?? '').normalize('NFKC').replace(/[\s　]+/g, '').replace(/[（]/g, '(').replace(/[）]/g, ')');
const hash = (str) => createHash('sha256').update(str, 'utf8').digest('hex').slice(0, 16);

/** Curated aliases are restricted to the indicated branch, avoiding cross-domain homonyms. */
const conceptDefinitions = [
  // Health / daily life.
  ['1','1.1.dementia','認知症','認知症|認知症の症状|認知症のケア'],
  ['1','1.1.parkinsons','パーキンソン病','パーキンソン病'],
  ['1','1.1.diabetes','糖尿病','糖尿病'],
  ['1','1.1.heart_failure','心不全','心不全'],
  ['1','1.1.depression','うつ病','うつ病|老年期うつ病'],
  ['1','1.1.delirium','せん妄','せん妄'],
  ['1','1.1.infections','感染症','感染症'],
  ['1','1.1.pressure_ulcer','褥瘡','褥瘡'],
  ['1','1.1.nutrition','低栄養・栄養障害','低栄養|高齢者の栄養・摂食嚥下機能'],
  ['1','1.1.health','加齢・疾病・病態','加齢・疾病・病態|高齢者の健康状態|健康状態・生活機能'],
  ['1','1.2.lab','検査・検査値','検査・検査値|検査項目・検査値の意味'],
  ['1','1.2.vitals','バイタルサイン','バイタルサイン|血圧'],
  ['1','1.3','生活機能','高齢者の生活機能・身体機能|生活機能|嚥下機能'],
  ['1','1.4','生活背景','生活背景|高齢者の生活背景・家族環境'],
  // Generic care skills (separate from service-specific operating standards).
  ['2','2.1','支援原則・倫理','支援原則・倫理|支援の原則・方法|自立支援・権利尊重'],
  ['2','2.2','相談援助','相談援助|相談援助・ソーシャルワーク|ソーシャルワーク|相談援助の面接技術|面接のコミュニケーション技術|インテーク面接'],
  ['2','2.3','ケアマネジメント','ケアマネジメント|介護支援専門員による支援|個別事例の支援'],
  ['2','2.3.assessment','アセスメント','アセスメント|課題分析標準項目|介護予防支援のアセスメント'],
  ['2','2.3.care_plan','ケアプラン','ケアプラン|居宅サービス計画|介護予防サービス計画|介護予防サービス・支援計画書|居宅サービス計画原案'],
  ['2','2.3.service_meeting','サービス担当者会議','サービス担当者会議'],
  ['2','2.3.monitoring','モニタリング','モニタリング'],
  ['2','2.4','支援技術','支援技術|具体的な支援技術|日常生活援助・終末期ケア|医療・看護の共通技術|リハビリテーション|在宅医療管理|在宅酸素療法|食事介助のアセスメント'],
  ['2','2.4.family_support','家族支援','家族支援'],
  ['2','2.4.end_of_life','終末期ケア','終末期ケア|臨死期のケア'],
  ['2','2.4.oral','口腔ケア','口腔ケア'],
  ['2','2.4.infection_control','感染予防','感染予防'],
  // Provider / facility specificity is preserved rather than pooled.
  ['3','3.1.home.visiting_care','訪問介護','訪問介護|指定訪問介護'],
  ['3','3.1.home.visiting_bath','訪問入浴介護','訪問入浴介護'],
  ['3','3.1.home.visiting_nurse','訪問看護','訪問看護'],
  ['3','3.1.home.visiting_rehab','訪問リハビリテーション','訪問リハビリテーション'],
  ['3','3.1.home.home_medical','居宅療養管理指導','居宅療養管理指導'],
  ['3','3.1.home.day_care','通所介護','通所介護'],
  ['3','3.1.home.day_rehab','通所リハビリテーション','通所リハビリテーション'],
  ['3','3.1.home.short_stay_life','短期入所生活介護','短期入所生活介護'],
  ['3','3.1.home.short_stay_medical','短期入所療養介護','短期入所療養介護'],
  ['3','3.1.home.specific_facility','特定施設入居者生活介護','特定施設入居者生活介護'],
  ['3','3.1.home.welfare_equipment','福祉用具貸与','福祉用具貸与'],
  ['3','3.1.home.welfare_sale','特定福祉用具販売','特定福祉用具販売'],
  ['3','3.1.community.night','夜間対応型訪問介護','夜間対応型訪問介護'],
  ['3','3.1.community.regular_round','定期巡回・随時対応型訪問介護看護','定期巡回・随時対応型訪問介護看護'],
  ['3','3.1.community.small_multi','小規模多機能型居宅介護','小規模多機能型居宅介護'],
  ['3','3.1.community.nursing_multi','看護小規模多機能型居宅介護','看護小規模多機能型居宅介護'],
  ['3','3.1.community.group_home','認知症対応型共同生活介護','認知症対応型共同生活介護|認知症対応型共同生活介護(グループホーム)'],
  ['3','3.1.community.dementia_day','認知症対応型通所介護','認知症対応型通所介護'],
  ['3','3.1.community.day','地域密着型通所介護','地域密着型通所介護'],
  ['3','3.1.facilities.tokuyo','介護老人福祉施設（特養）','介護老人福祉施設(特養)|介護老人福祉施設|特養の施設サービス計画'],
  ['3','3.1.facilities.roken','介護老人保健施設（老健）','介護老人保健施設(老健)|介護老人保健施設'],
  ['3','3.1.facilities.medical','介護医療院','介護医療院'],
  ['3','3.1.facilities.old_medical','介護療養型医療施設','介護療養型医療施設'],
  ['3','3.1.home_support','居宅介護支援','居宅介護支援|指定居宅介護支援|指定居宅介護支援事業者'],
  ['3','3.1.preventive_support','介護予防支援','介護予防支援|指定介護予防支援'],
  ['3','3.1.preventive','介護予防サービス','介護予防サービス|介護予防通所介護'],
  ['3','3.1.community','地域密着型サービス','地域密着型サービス'],
  ['3','3.1.home','居宅サービス','居宅サービス|居宅介護サービス'],
  ['3','3.2.sakoju','サービス付き高齢者向け住宅','サービス付き高齢者向け住宅|サ高住'],
  ['3','3.2.paid_home','有料老人ホーム','有料老人ホーム'],
  ['3','3.3.care_manager','介護支援専門員','介護支援専門員'],
  ['3','3.4.community_center','地域包括支援センター','地域包括支援センター'],
  ['3','3.4.national_health_insurance','国民健康保険団体連合会','国民健康保険団体連合会'],
  // Statutory schemes are distinct from providers and care methods.
  ['4','4.1.principles','介護保険の目的・理念','目的・理念・国民の努力義務|介護保険法第1条・第2条|介護保険法第4条・国民の努力と義務'],
  ['4','4.1.reform','介護保険制度改正','2011年介護保険制度改正|介護保険制度の2017年改正'],
  ['4','4.1.eligibility','被保険者資格','介護保険の被保険者資格|介護保険の被保険者|介護保険の第2号被保険者|第1号被保険者|第2号被保険者|介護保険の特定疾病'],
  ['4','4.1.eligibility.address','住所地特例','住所地特例|介護保険の住所地特例'],
  ['4','4.1.certification','要介護・要支援認定','要介護認定|要介護・要支援認定|介護認定審査会|要介護認定の主治医意見書|要介護認定の広域的実施'],
  ['4','4.1.benefits','保険給付','保険給付|介護保険給付|介護保険の給付|介護保険給付・利用者負担|介護給付・利用者負担'],
  ['4','4.1.benefits.limit','区分支給限度基準額','区分支給限度基準額'],
  ['4','4.1.benefits.home_renovation','居宅介護住宅改修費','居宅介護住宅改修費'],
  ['4','4.1.benefits.high_cost','高額介護サービス費','高額介護サービス費'],
  ['4','4.1.benefits.supplementary','特定入所者介護サービス費','特定入所者介護サービス費'],
  ['4','4.1.benefits.coordination','他制度との給付調整','介護保険と他制度の給付調整|介護保険と生活保護(介護扶助)'],
  ['4','4.1.finance','保険料・財政','保険料・財政|保険料・公費・財政|介護保険財政|介護保険の財政・保険料|財政安定化基金'],
  ['4','4.1.finance.first','第1号被保険者保険料','第1号被保険者保険料|第1号被保険者の保険料|第1号被保険者の保険料滞納'],
  ['4','4.1.finance.second','第2号被保険者保険料','第2号被保険者保険料'],
  ['4','4.1.administration','行政・制度運営','行政・制度運営|介護保険制度の管理運営|介護保険法令・条例基準'],
  ['4','4.1.administration.authority','国・都道府県・市町村の権限','国・都道府県・市町村の権限|市町村の権限|市町村の介護保険事務'],
  ['4','4.1.administration.designation','事業者に共通する指定・監督','事業者に共通する指定・監督|介護保険サービス事業者の指定・監督'],
  ['4','4.1.administration.payment','審査支払・国保連','審査支払・国保連|国民健康保険団体連合会|社会保険診療報酬支払基金'],
  ['4','4.1.administration.appeals','介護保険の審査請求','介護保険審査会|介護保険審査会への審査請求|介護保険の審査請求'],
  ['4','4.1.administration.disclosure','介護サービス情報公表制度','介護サービス情報公表制度|介護サービス情報の公表制度'],
  ['4','4.1.community_policy','地域施策・地域支援事業','地域施策・地域支援事業|地域支援事業|地域支援事業・介護予防事業|一般介護予防事業'],
  ['4','4.1.community_policy.comprehensive','包括的支援事業','包括的支援事業'],
  ['4','4.1.community_policy.support','介護予防・日常生活支援総合事業','介護予防・日常生活支援総合事業|第1号介護予防支援事業'],
  ['4','4.1.community_policy.plans','介護保険事業計画','介護保険事業計画|市町村介護保険事業計画|市町村の介護保険事業計画'],
  ['4','4.1.community_policy.meeting','地域ケア会議','地域ケア会議'],
  ['4','4.2.dementia_basic_act','認知症基本法','認知症基本法|認知症施策'],
  ['4','4.2.guardianship','成年後見制度','成年後見制度|成年後見'],
  ['4','4.2.public_assistance','生活保護制度','生活保護|生活保護制度'],
  ['4','4.2.disability','障害福祉制度','障害福祉|障害者福祉制度|障害者総合支援法'],
  ['4','4.2.medical.late','後期高齢者医療制度','後期高齢者医療制度'],
  ['4','4.2.abuse','高齢者虐待防止制度','高齢者虐待防止|高齢者虐待防止制度'],
  ['4','4.2.elder_welfare','老人福祉制度','老人福祉|老人福祉制度'],
  ['4','4.2.daily_life_support','日常生活自立支援事業','日常生活自立支援事業|地域福祉権利擁護事業'],
  ['4','4.2.poverty','生活困窮者自立支援制度','生活困窮者自立支援制度'],
  ['4','4.0.social_insurance','社会保険一般','社会保険方式|社会保険一般'],
  ['4','4.1','介護保険制度','介護保険制度'],
];
const aliases = new Map();
for (const [root, id, label, names] of conceptDefinitions) {
  for (const alias of names.split('|')) {
    const k = root + '|' + norm(alias);
    const old = aliases.get(k);
    if (old && old.id !== id) throw new Error('conflicting concept alias: ' + k);
    aliases.set(k, { root, id, label });
  }
}
const attributeDefinitions = [
  ['applicable_services','適用サービス', /適用サービス|対象サービス|給付対象となるサービス|対象となるサービス/],
  ['staffing','人員配置', /人員配置|人員基準|配置基準|職種別基準|常勤換算|勤務体制|夜勤体制/],
  ['equipment','設備基準', /設備基準|設備・施設基準|床面積|居室の基準|設備要件/],
  ['fees','費用・報酬', /報酬・費用|介護報酬|算定|加算|減算|費用負担|利用料|利用者負担|自己負担|負担割合/],
  ['eligibility','対象・要件', /対象・利用要件|利用対象|入所要件|対象者|対象施設|支給要件|適用除外|被保険者資格|資格取得|資格喪失|対象・資格/],
  ['procedures','申請・手続', /申請手続|審査請求|申請・調査|届出|申請代行|手続/],
  ['term','期限・有効期間', /有効期間|保存期間|時効|有効期限|期限|更新期間/],
  ['operations','運営基準', /運営基準|具体的取扱方針|指定基準|運営上の義務|提供拒否|記録の作成|記録の保存|秘密保持|法定義務/],
  ['registration','登録・更新', /登録・更新|登録の移転|登録要件|資格要件|更新研修|資格登録/],
  ['care_plan','計画作成', /計画作成|ケアプラン|サービス計画|計画の策定|計画策定|計画の記載|計画書/],
  ['assessment','アセスメント', /アセスメント|課題分析|認定調査票|基本チェックリスト/],
  ['monitoring','モニタリング', /モニタリング|再アセスメント/],
  ['coordination','連携・調整', /給付調整|優先関係|資源調整|支援調整|意向調整|退院支援/],
  ['authority','役割・権限・責務', /権限|責務|実施主体|主体・権限|役割|職務|業務範囲|業務権限|業務・責務/],
  ['benefits','給付内容・条件', /給付の対象|給付の条件|保険給付|補足給付|限度基準額|支給限度|給付方法/],
  ['financing','保険料・財源', /保険料|財源|財政調整|徴収|公費負担/],
  ['symptoms','症状・徴候', /症状|徴候|BPSD|身体所見|臨死期の徴候/],
  ['tests','検査・評価', /検査値|検査・診断|検査項目|検査・評価|診断|判定基準/],
  ['treatment','治療・ケア', /治療|ケア上の注意|疾病固有の介護|服薬管理|療養上の注意/],
  ['prevention','予防', /感染予防|介護予防|予防の方法|予防策/],
  ['services','提供内容', /提供内容|提供サービス|サービス内容|支援内容|サービス提供内容|食事支援|食事介助/],
  ['principles','目的・理念・基本方針', /基本理念|制度の目的|基本方針|目的・理念|原則・倫理/],
  ['description','定義・仕組み', /定義|概念|制度構造|制度の仕組み|法定の位置付け/],
];
const genericSubjects = new Set(['介護保険制度','加齢・疾病・病態','高齢者の健康状態','健康状態・生活機能','ケアマネジメント','具体的な支援技術','支援技術','行政・制度運営','介護保険給付']);
const pathConceptHints = [
  ['4', '4.1.benefits.limit', ['区分支給限度基準額']],
  ['4', '4.1.benefits.home_renovation', ['居宅介護住宅改修費']],
  ['4', '4.1.certification', ['要介護認定','要介護・要支援認定']],
  ['4', '4.1.eligibility.address', ['住所地特例']],
  ['4', '4.1.eligibility', ['被保険者資格']],
  ['4', '4.1.benefits.supplementary', ['特定入所者介護サービス費']],
  ['4', '4.1.benefits.high_cost', ['高額介護サービス費']],
  ['4', '4.1.finance', ['保険料・財政']],
  ['4', '4.1.community_policy', ['地域施策・地域支援事業']],
  ['4', '4.1.benefits', ['保険給付']],
  ['4', '4.1.administration', ['行政・制度運営']],
  ['2', '2.3.assessment', ['アセスメント']],
  ['2', '2.3.care_plan', ['ケアプラン']],
  ['2', '2.3.monitoring', ['モニタリング']],
];
const byId = new Map(conceptDefinitions.map(([root,id,label])=>[root+'|'+id,{root,id,label}]));
function conceptFor(row, path) {
  const root = path[0];
  const raw = norm(row.subject_concept);
  let found = aliases.get(root+'|'+raw);
  if (!found) {
    // Accept an explicit subject followed by grammatical suffix, never a
    // keyword merely appearing somewhere in the original statement.
    const candidates = [...aliases.entries()]
      .filter(([key])=>key.startsWith(root+'|'))
      .map(([key,value])=>({alias:key.slice(2),value}))
      .filter(({alias})=>alias.length >= 4 && (raw.startsWith(alias+'の') || raw.startsWith(alias+'における')))
      .sort((a,b)=>b.alias.length-a.alias.length);
    if (candidates.length && (candidates.length===1 || candidates[0].alias.length>candidates[1].alias.length))
      found=candidates[0].value;
  }
  if (genericSubjects.has(raw)) {
    // Only explicit, branch-appropriate path components; never the very
    // specific final assertion (e.g. "訪問介護" as an applicable service).
    for (const [branch,id,hints] of pathConceptHints) {
      if (root !== branch) continue;
      const matched = path.slice(2,-1).some(segment=>hints.some(hint=>norm(segment)===norm(hint)));
      if (matched && id!==found?.id) { found=byId.get(root+'|'+id)??found; break; }
    }
  }
  if (found) return {...found, resolution:'curated', source_subject:row.subject_concept};
  if (!raw) return {root,id:'unresolved.'+hash(root+'|'+JSON.stringify(path.slice(0,5))),label:'要概念確認',resolution:'unresolved',source_subject:row.subject_concept};
  // Distinct named concepts never collapse merely because a path label looks
  // similar. They form a provisional registry that can be reviewed explicitly.
  return {root,id:'provisional.'+hash(root+'|'+raw),label:row.subject_concept,resolution:'provisional',source_subject:row.subject_concept};
}

function attributeFor(row, path, concept) {
  const all = path.slice(2).filter(x=>typeof x==='string'&&!/^[1-4](?:\.[a-z0-9_]+)+$/.test(x));
  const subject = norm(row.subject_concept), label = norm(concept.label);
  // Strip the subject itself and broad taxonomy labels. Attribute evidence
  // comes from the topic path, not an assertion's object alone.
  const hints = all.filter((segment,i)=>norm(segment)!==subject && norm(segment)!==label);
  let explicit = norm(row.attribute);
  // In recent reviews a single assertion value is sometimes stored in
  // attribute. Use the path's "applicable services" level instead.
  const allClues = [row.attribute, ...hints].join(' > ');
  if (concept.id==='4.1.benefits.home_renovation' && /支給対象性|対象工事|支給対象工事|対象となる工事/.test(allClues))
    return {id:'eligible_work',label:'支給対象となる工事',resolution:'curated'};
  if (concept.id==='4.1.benefits.home_renovation' && /支給限度額|支給上限額/.test(allClues))
    return {id:'limit',label:'支給限度額',resolution:'curated'};
  if (concept.root==='3' && /人員配置|管理者(の)?資格|提供責任者(の)?資格|職員.*資格|勤務形態|常勤要件|常勤配置|夜勤.*配置/.test(allClues))
    return {id:'staffing',label:'人員配置',resolution:'curated'};
  if (concept.root==='3' && /設備基準|廊下幅|食堂・機能訓練室|居室の定員/.test(allClues))
    return {id:'equipment',label:'設備基準',resolution:'curated'};
  const hasApplicable = hints.some(x=>/適用サービス|対象サービス/.test(x));
  if (hasApplicable) return {id:'applicable_services',label:'適用サービス',resolution:'curated'};
  // Prefer an informative attribute with a known category; otherwise use
  // the most specific conceptual path evidence.
  const clues = [row.attribute,...hints.slice(-4).reverse()];
  for (const item of clues) {
    const normalized = norm(item);
    if (!normalized || normalized===subject || normalized===label) continue;
    for (const [id,attributeLabel,pattern] of attributeDefinitions) {
      if (pattern.test(normalized)) return {id,label:attributeLabel,resolution:'curated'};
    }
  }
  // Absence of a reliable attribute is preserved as unknown, not silently
  // represented as a verified "definition" or an arbitrary leaf.
  return {id:'unresolved',label:'属性未整理',resolution:'unresolved'};
}

export function identifyDrawer(row, path) {
  if (!path || path.length < 2) return null;
  const concept = conceptFor(row,path);
  const attribute = attributeFor(row,path,concept);
  return {
    id:'drawer32.'+concept.root+'.'+concept.id+'#'+attribute.id,
    root:concept.root,
    concept_id:concept.id,
    concept_label:concept.label,
    attribute_id:attribute.id,
    attribute_label:attribute.label,
    review_required:concept.resolution!=='curated' || attribute.resolution!=='curated',
    concept_resolution:concept.resolution,
    attribute_resolution:attribute.resolution,
  };
}
