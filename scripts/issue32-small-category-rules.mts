/** Migration suggestions against the already committed top-down plan.
 * Rules choose the knowledge target; they do not judge truth or approve reviews.
 */
import { smallConcepts, propositionId, targetSourceFingerprint, type Proposition, type TargetAssignment } from './issue32-target-taxonomy.mts';

export interface LegacyDrawer {
  id: string; root: string; concept_id: string; concept_label: string;
  attribute_id: string; attribute_label: string; review_required: boolean;
  concept_resolution: string; attribute_resolution: string;
}
type Rule = readonly [string, RegExp];
const clean = (s: unknown) => String(s ?? '').normalize('NFKC').replace(/\s+/g, '');
const clinical: Rule[] = [
  ['4.4.adverse_effects', /副作用|薬剤性|薬剤の影響|多剤併用|ポリファーマシー|薬疹/],
  ['4.4.pharmacology', /薬物動態|薬剤の作用|薬剤の代謝|薬剤の排泄|薬物の代謝|薬物の排泄|薬剤相互作用|薬理/],
  ['4.3.dementia_care', /認知症.*(?:個別ケア|環境配慮|固有のケア)|パーソン・センタード/],
  ['4.3.mci', /軽度認知障害|MCI/], ['4.3.delirium', /せん妄/],
  ['4.3.depression', /うつ|抑うつ|気分障害/], ['4.3.addiction', /アルコール/],
  ['4.3.psychosis', /統合失調|妄想性障害|高齢者の精神疾患/], ['4.3.neurosis', /神経症|不安障害/],
  ['4.3.dementia', /認知症|アルツハイマー|レビー小体|前頭側頭|ピック病/],
  ['4.1.frailty', /フレイル|サルコペニア|ロコモティブ/], ['4.1.disuse', /廃用|生活不活発/],
  ['4.1.pressure_ulcer', /褥瘡/], ['4.1.dehydration', /脱水|ナトリウム欠乏|口渇・水分/],
  ['4.1.malnutrition', /低栄養|栄養障害|ビタミン.*欠乏/], ['4.1.falls', /転倒|転落/],
  ['4.1.continence', /尿失禁|便失禁|便秘|尿閉/], ['4.1.sleep', /睡眠障害|高齢者の睡眠/],
  ['4.2.parkinsons', /パーキンソン/], ['4.2.heart_failure', /心不全/],
  ['4.2.ischemic_heart', /狭心症|心筋梗塞/], ['4.2.arrhythmia', /不整脈|心房細動|期外収縮|心室細動/],
  ['4.2.vascular', /高血圧|動脈硬化|循環器疾患|血栓/],
  ['4.2.stroke', /脳血管|脳卒中|脳梗塞|高次脳機能|失語|片麻痺|慢性硬膜下血腫/],
  ['4.2.neurological', /ALS|筋萎縮|神経難病|難病|脊髄小脳|進行性核上|てんかん/],
  ['4.2.respiratory', /COPD|閉塞性肺|喘息|呼吸器疾患|呼吸不全/],
  ['4.2.metabolic', /糖尿病|ケトアシドーシス|メタボリック/],
  ['4.2.kidney_urinary', /腎不全|腎機能|前立腺|泌尿器/],
  ['4.2.liver_digestive', /肝不全|肝硬変|消化器/], ['4.2.cancer', /がん|癌|白血病/],
  ['4.2.musculoskeletal', /骨粗鬆|骨折|関節|脊柱|頸髄|脊髄損傷/],
  ['4.2.infection', /感染症|肺炎|結核|インフルエンザ|MRSA|ノロ|疥癬|帯状疱疹|肝炎|敗血症|コロナ/],
  ['4.2.skin', /皮膚疾患/], ['4.2.sensory', /白内障|緑内障|黄斑|難聴|眼疾患/],
  ['4.4.consciousness', /意識状態|JCS|傾眠/],
  ['4.4.respiratory_signs', /チアノーゼ|パルスオキシ|酸素飽和|チェーンストークス|下顎呼吸|死前喘鳴/],
  ['4.4.vitals', /バイタル|血圧|体温|発熱|徐脈|頻呼吸|脈拍/],
  ['4.4.lab', /検査|検査値|クレアチニン|BUN|CRP|血糖|ホルター|骨密度/],
  ['4.4.clinical_reasoning', /診断・治療の基本|予後|EBM|NBM|エビデンス|ナラティブ/],
  ['4.4.symptoms', /症状・徴候|食欲不振|めまい|窒息の症状/],
  ['4.5.icf', /ICF|国際生活機能/], ['4.5.swallowing', /嚥下|誤嚥|摂食/],
  ['4.5.oral_function', /口腔機能|口腔乾燥|味覚|オーラルフレイル/],
  ['4.5.nutrition', /栄養|身体計測|BMI|アルブミン|グロブリン/],
  ['4.5.movement', /拘縮|姿勢|重心|バランス|ボディメカニクス/],
  ['4.5.adl', /ADL|IADL|生活機能|身体機能/],
  ['4.1.aging', /加齢|老化|高齢者の環境適応|感染抵抗力/],
  ['4.1.gerontology', /老年症候群|高齢者の疾病/],
];
const care: Rule[] = [
  ['4.6.acp', /ACP|アドバンス・ケア|終末期の意思決定/],
  ['4.6.death_certificate', /死亡診断書|死体検案|死亡診断/],
  ['4.6.parenteral', /中心静脈栄養/], ['4.6.enteral', /経管栄養|胃ろう|胃瘻/],
  ['4.6.dialysis_care', /透析|腹膜灌流/],
  ['4.6.respiratory_care', /酸素療法|人工呼吸|喀痰吸引|吸引|ネブライザー|口すぼめ呼吸/],
  ['4.6.pain', /疼痛|オピオイド/], ['4.6.end_of_life', /終末期|看取り|臨死|グリーフ/],
  ['4.6.excretion_care', /排泄援助|カテーテル|ストーマ|自己導尿|自己導尿/],
  ['4.6.medication_support', /服薬|食事・服薬|PTP/], ['4.6.oral_care', /口腔ケア|口腔清掃/],
  ['4.6.food_care', /食事援助|食事介助|食事の介護|食事支援|食事を通して|食事をさせ|食事摂取量|食形態/], ['4.6.skin_care', /清潔|入浴|皮膚.*ケア/],
  ['4.6.infection_control', /感染予防|ワクチン|予防接種|標準予防|手洗い|消毒/],
  ['4.6.emergency', /安全管理|急変|救命|窒息|緊急時|頭部打撲|ヒートショック/],
  ['4.6.professional_practice', /看護師|介護職員|医師・歯科医師|薬剤師|専門職|医療従事者|診察.*実施/],
  ['4.4.clinical_reasoning', /医学的診断|診断|治療効果|治療は/],
  ['4.1.sleep', /安眠|就寝|生活リズム/], ['4.6.excretion_care', /排泄|排便/],
  ['4.5.rehab', /リハビリ|機能訓練|運動/], ['4.5.assistive_fit', /福祉用具の適合|移動補助具|福祉用具・住宅設備/],
];
const social: Rule[] = [
  ['5.3.rights_policy', /成年後見制度利用促進|認知症基本法/],
  ['5.3.voluntary_guardianship', /任意後見/],
  ['5.3.guardianship_procedure', /後見.*審判|後見.*請求|後見.*申立|後見.*監督/],
  ['5.3.legal_guardianship', /成年後見|被保佐|保佐人|補助人|後見人/],
  ['5.3.rights_support', /日常生活自立支援|地域福祉権利擁護/],
  ['5.3.abuse_response', /通報義務|虐待.*権限|虐待.*対応|養介護施設|養護者支援/],
  ['5.3.abuse_definition', /高齢者虐待/], ['5.3.restraint', /身体拘束|拘束の防止/],
  ['5.4.public_assistance', /生活保護|介護扶助/], ['5.4.poverty', /生活困窮/],
  ['5.4.elder_welfare', /老人福祉制度|老人福祉法/],
  ['5.4.disability', /障害福祉|障害者総合支援|手帳/],
  ['5.4.medical_insurance', /後期高齢者医療|医療保険制度/],
  ['5.4.social_insurance', /社会保険一般|社会保険方式|社会保障/],
  ['5.4.pension_employment', /年金保険|両立支援|介護休業/],
  ['5.4.health_policy', /健康日本|公的助成|副作用被害救済|感染症.*法的|看取り.*法制度|終末期医療.*法制度/],
  ['5.4.community_welfare', /地域福祉・地域共生|その他の法律・制度/],
  ['5.2.family_issues', /老々介護|8050|ダブルケア|介護離職/],
  ['5.2.family', /家族支援|家族介護|ヤングケアラー/],
  ['5.2.group', /集団援助|グループワーク/], ['5.2.community', /地域援助|社会資源開発|地域の見守り/],
  ['5.5.disaster', /災害|福祉避難所/],
  ['5.5.home_environment', /住環境|住宅設備/],
  ['5.5.housing', /高齢者の住まい|有料老人ホーム|サービス付き|養護老人|軽費老人/],
  ['5.5.population', /人口|世帯|生活背景|限界集落|生活・疾病統計/],
  ['5.5.informal', /インフォーマル|物的・地域資源/],
  ['5.5.community_services', /配食|支援資源|認知症カフェ/],
  ['5.5.support_agencies', /支援機関|医療機関|救急相談|支援コーディネーター|医療センター/],
  ['5.1.intake', /インテーク/], ['5.1.relationship', /援助関係|共感|自己覚知|個別援助/],
  ['5.1.process', /援助過程/], ['5.1.difficult_cases', /支援困難|アウトリーチ|セルフ・ネグレクト/],
  ['5.1.privacy', /守秘|個人情報/],
  ['5.1.principles', /個別化|非審判|支援原則|アドボカシー|意思決定|説明と同意|自立支援/],
  ['5.1.interview', /相談援助|面接|コミュニケーション|質問技法|回想法|栄養相談/],
];
const serviceRules: Rule[] = [
  ['3.7.nursing_multi', /看護小規模多機能|複合型サービス/],
  ['3.7.small_multi', /小規模多機能型居宅介護/], ['3.7.regular_round', /定期巡回|随時対応型訪問介護看護/],
  ['3.7.night', /夜間対応型訪問介護/], ['3.7.community_day', /地域密着型通所介護/],
  ['3.7.dementia_day', /認知症対応型通所介護/], ['3.7.group_home', /認知症対応型共同生活介護|グループホーム/],
  ['3.7.community_facility', /地域密着型介護老人福祉施設/], ['3.7.community_specific', /地域密着型特定施設/],
  ['3.3.medical_day', /療養通所介護/], ['3.3.day_rehab', /通所リハビリテーション/], ['3.3.day_care', /通所介護/],
  ['3.2.visiting_bath', /訪問入浴/], ['3.2.visiting_rehab', /訪問リハビリテーション/],
  ['3.2.visiting_nurse', /訪問看護/], ['3.2.visiting_care', /訪問介護/], ['3.2.home_medical', /居宅療養管理指導/],
  ['3.4.short_stay_medical', /短期入所療養介護/], ['3.4.short_stay_life', /短期入所生活介護/],
  ['3.5.selection_system', /福祉用具貸与・販売|貸与.*販売.*選択/], ['3.5.sale', /福祉用具販売/], ['3.5.rental', /福祉用具貸与/],
  ['3.6.medical', /介護医療院/], ['3.6.old_medical', /介護療養型医療施設/], ['3.6.roken', /介護老人保健施設|老健/],
  ['3.6.tokuyo', /介護老人福祉施設|特養/], ['3.6.specific_facility', /特定施設入居者生活介護/],
];
const hit = (rules: Rule[], text: string) => rules.find(([, re]) => re.test(text))?.[0];

function finance(text: string) {
  if (/給付制限|支払方法の変更|給付.*差止|給付.*減額/.test(text)) return '1.4.restriction';
  if (/財政安定化基金/.test(text)) return '1.2.stabilization_fund';
  if (/調整交付金/.test(text)) return '1.2.adjustment_grant';
  if (/地域支援事業.*(?:財源|負担|交付金)|地域支援事業支援交付金/.test(text)) return '1.2.community_funding';
  if (/特別会計|財政収支|積立|予算/.test(text)) return '1.2.accounting';
  if (/第1号/.test(text) && /第2号/.test(text)) return '1.2.funding';
  if (/第2号|総報酬割|介護納付金/.test(text)) return '1.2.second_premium';
  if (/第1号|普通徴収|特別徴収/.test(text)) return '1.2.first_premium';
  return '1.2.funding';
}
function certification(text: string, attribute: string) {
  if (/審査請求|介護保険審査会/.test(text)) return '1.5.appeals';
  if (/特定疾病/.test(text)) return '1.3.specified_diseases';
  if (/主治医意見書|主治医がいない/.test(text) || attribute === 'physician_opinion') return '1.3.physician_opinion';
  if (/認定審査会|第2次|二次判定|合議体/.test(text) || attribute === 'committee') return '1.3.review_board';
  if (/基準時間|第1次|一次判定|コンピュータ判定/.test(text)) return '1.3.primary_judgment';
  if (/有効期間|効力|結果通知/.test(text) || attribute === 'validity') return '1.3.validity';
  if (/更新|区分変更|取消し|職権変更/.test(text)) return '1.3.renewal_change';
  if (/認定調査|基本調査|特記事項|調査員/.test(text) || attribute === 'survey') return '1.3.assessment_survey';
  if (/申請|転入/.test(text) || attribute === 'application') return '1.3.application';
  return '1.3.care_levels';
}
const institutionalDesignation = /指定権者|指定の取消|指定取消|指定を取り消|指定.*更新|みなし指定|都道府県知事.*指定|市町村(?:の)?長.*指定|指定.*都道府県知事|指定.*市町村(?:の)?長|立入検査|指定の申請|指定.*申請|指定事業者.*申請/;
const broadLegacy = new Set(['1.1.health','1.1.geriatric','1.3','1.4','2.1','2.2','2.3','2.4','3.1','3.1.home','3.1.facilities','3.1.preventive','3.1.community','3.2','4.1','4.1.finance','4.1.certification','4.1.benefits','4.1.administration','4.1.community_policy']);
// Individual boundary readings, kept as migration rules. The persisted current
// assignment is on the annual record, and later edits must not rerun this blindly.
const individual: Record<string, readonly [string,string]> = {
  '2005-21/c3/p1':['1.5.complaints','利用者と事業者の苦情に市町村が介入できるかという制度の知識'],
  '2005-21/c5/p1':['1.5.complaints','苦情を受けた場合の国保連への連絡義務という制度の知識'],
  '2007-28/c2/p1':['4.6.food_care','咀嚼困難者に対する食事回数・補食の具体的な援助'],
  '2007-28/c3/p1':['4.6.food_care','本人に合わせた食事場面の援助'],
  '2007-28/c5/p1':['4.6.food_care','食生活を通した自立・生きがいの援助'],
  '2008-58/c5/p1':['3.1.classification','営利法人のサービスもフォーマル資源に含むかという共通の制度区分'],
  '2010-31/c4/p1':['4.1.sleep','睡眠を促す環境条件を問う知識'],
  '2013-23/c2/p1':['3.8.preventive_office','指定介護予防支援の提供方針として地域活動を活用'],
  '2013-23/c3/p1':['3.8.preventive_office','介護予防支援の提供方針として地域支援事業との一貫性を確保'],
  '2013-23/c4/p1':['3.8.preventive_office','介護予防支援の基本方針を問う命題'],
  '2013-23/c5/p1':['3.8.preventive_office','介護予防支援の基本方針として本人の主体性を支援'],
  '2016-10/c5/p1':['3.1.staff_equipment','特定施設名の人員ではなく介護保険施設に共通するケアマネ配置'],
  '2016-13/c3/p1':['1.5.provider_designation','地域密着型の公募指定における行政の選考基準'],
  '2016-13/c4/p1':['1.5.authority','サービス事業者の運営実践ではなく条例制定の主体を問う'],
  '2024-20/c1/p1':['3.8.home_plan_rules','指定居宅介護支援業務としての標準項目に基づく課題分析'],
  '2024-20/c2/p1':['3.8.home_plan_rules','指定居宅介護支援業務としてのサービス選択支援'],
  '2024-20/c5/p1':['3.8.home_plan_rules','指定居宅介護支援業務としてのモニタリング'],
  '2024-26/c1/p1':['4.1.gerontology','高齢者の疾病による日常活動低下という疾病の一般的特徴'],
};

export function suggestTarget(row: Proposition, legacy: LegacyDrawer): TargetAssignment {
  const key = legacy.concept_id, label = clean(legacy.concept_label);
  const knowledge = clean(row.knowledge_target_review?.needed_knowledge);
  const p = clean(row.proposition), stem = clean(row.question_stem);
  const metadata = clean(row.subject_concept) + ' ' + clean(row.attribute);
  // Broad old attributes enumerate several alternatives (e.g. eligibility,
  // address exception and exclusions). Never let that list decide placement.
  const details = knowledge || p;
  const caseManager = /介護支援専門員|ケアマネ|ケアプラン|居宅サービス計画|介護予防サービス計画/.test(stem + knowledge + row.subject_concept);
  let chosen: string | undefined, method: TargetAssignment['method'] = 'legacy_concept';
  let review = legacy.review_required, reason = '旧概念とトップダウン小分類の対象が対応するため移行';
  const use = (id: string, why: string, uncertain = false) => { chosen = id; method = 'knowledge_rule'; reason = why; review ||= uncertain; };

  if (legacy.root === '4') {
    if (key.startsWith('4.1.finance')) chosen = finance((key === '4.1.finance' ? '' : label) + ' ' + details);
    else if (key.startsWith('4.1.certification')) chosen = key.endsWith('.statistics') ? '1.1.statistics' : certification(details + ' ' + label, legacy.attribute_id);
    else if (key.startsWith('4.1.benefits')) {
      const specific: Record<string,string> = { coordination:'coordination',high_cost:'high_cost',home_renovation:'home_renovation',
        limit:'limit',medical_total:'medical_total',supplementary:'supplementary',social_welfare_discount:'copayment' };
      chosen = specific[key.split('.').at(-1)!] ? '1.4.' + specific[key.split('.').at(-1)!] : undefined;
      if (!chosen) chosen = hit([
        ['1.4.coordination', /給付調整|優先関係|他制度/], ['1.4.restriction', /給付制限|給付.*差止|給付.*減額|支払方法の変更/],
        ['1.4.high_cost', /高額介護サービス/], ['1.4.medical_total', /高額医療合算/], ['1.4.supplementary', /特定入所者|補足給付/],
        ['1.4.home_renovation', /住宅改修/], ['1.4.limit', /支給限度|限度基準/], ['1.4.copayment', /利用者負担|自己負担|食費|居住費/],
        ['1.4.benefit_payment', /償還|現物|請求|支給方法|支払方法|給付方法|事業者.*支払/],
      ], details) ?? '1.4.benefit_types';
    } else if (key.startsWith('4.1.eligibility')) {
      chosen = /特定疾病/.test(details) ? '1.3.specified_diseases' : /住所地特例/.test(label + details) ? '1.1.address' :
        /適用除外/.test(label + details) ? '1.1.exclusion' : /第2号|40歳/.test(details) ? '1.1.second_insured' : '1.1.first_insured';
    } else if (key.startsWith('4.1.community_policy')) {
      chosen = hit([
        ['1.6.prefecture_plan', /都道府県.*事業支援計画/], ['1.6.municipal_plan', /介護保険事業計画/],
        ['1.6.care_meeting', /地域ケア会議/], ['1.6.checklist', /基本チェックリスト/],
        ['1.6.preventive_cm', /介護予防ケアマネジメント|第1号介護予防支援/], ['1.6.total_services', /総合事業/],
        ['1.6.prevention', /一般介護予防/], ['1.6.medical_dementia_policy', /認知症総合|生活支援体制|地域医療介護総合確保基金/],
        ['1.6.optional_projects', /保健福祉事業|成年後見制度利用支援|任意事業/],
        ['1.6.comprehensive', /包括的支援事業/],
      ], label + ' ' + details) ?? '1.6.comprehensive';
      if (/財源|負担割合|納付金|交付金/.test(knowledge || row.attribute)) chosen = finance(details);
    } else if (key.startsWith('4.1.administration')) {
      chosen = hit([
        ['1.5.appeals', /審査請求/], ['1.5.disclosure', /情報公表|情報の公表/], ['1.5.provider_designation', /指定・監督/],
        ['1.5.payment_review', /審査支払|国保連|給付費.*審査委員会/], ['1.5.fund_agencies', /支払基金|医療保険者/],
        ['1.5.complaints', /苦情/], ['1.5.limitation', /消滅時効|不正受給|徴収権限/],
      ], label) ?? '1.5.authority';
      if (chosen === '1.5.fund_agencies' && /財源|保険料|納付金|総報酬/.test(knowledge || row.attribute)) chosen = finance(details);
    } else if (key === '4.1.principles') chosen = '1.1.purpose';
    else if (key === '4.1.reform') chosen = '1.1.reform';
    else if (key === '4.1.statistics') chosen = '1.1.statistics';
    else if (key === '4.1') {
      chosen = hit([['1.1.address', /住所地特例/], ['1.3.care_levels', /認定者数/], ['1.1.statistics', /利用者数|統計|事業状況報告/],
        ['1.5.care_manager_registration', /介護支援専門員.*登録|資格.*更新|登録.*事務/], ['1.5.provider_designation', institutionalDesignation],
        ['1.6.care_meeting', /地域ケア会議/], ['1.4.copayment', /利用者負担割合/], ['1.2.second_premium', /第2号.*保険料/],
      ], details) ?? '1.1.purpose';
      if (chosen === '1.3.care_levels' && /認定者数/.test(details)) chosen = '1.1.statistics';
    } else chosen = hit(social, label) ?? hit(social, details);
  } else if (legacy.root === '3') {
    if (/^3\.1\.(home_support|preventive_support)$/.test(key)) {
      const preventive = key.endsWith('preventive_support');
      chosen = preventive ? '3.8.preventive_office' : '3.8.home_support_office';
      if (['care_plan','assessment','monitoring','procedures'].includes(legacy.attribute_id)) chosen = preventive ? '3.8.preventive_plan_rules' : '3.8.home_plan_rules';
      if (['documentation'].includes(legacy.attribute_id)) chosen = '3.8.home_records';
      if (legacy.attribute_id === 'fees') chosen = '3.8.home_fees';
      if (/介護認定審査会/.test(stem) && /認定調査員|出席|特記事項/.test(details)) chosen = '1.3.review_board';
    } else if (key === '3.3.care_manager') chosen = /登録|専門員証|資格|研修|試験/.test(details) ? '1.5.care_manager_registration' : '2.1.role';
    else if (key.startsWith('3.3.')) chosen = hit(care, label) ?? '4.6.professional_practice';
    else if (key === '3.4.community_center') chosen = '1.6.community_center';
    else if (/3\.4\.dementia_(coordinator|team)/.test(key)) chosen = '1.6.medical_dementia_policy';
    else if (key.startsWith('3.1.')) chosen = hit(serviceRules, label) ?? hit(serviceRules, details + ' ' + stem);
    else chosen = hit(serviceRules, label) ?? hit(social, label) ?? hit(care, label) ?? hit(clinical, label);
  } else if (legacy.root === '1') {
    chosen = hit(clinical, label) ?? hit(care, label) ?? hit(social, label);
    if (key.startsWith('1.2.')) chosen = hit(clinical.filter(([id]) => id.startsWith('4.4.')), label) ?? '4.4.lab';
    if (['1.2.dying_signs','1.2.death_rattle','1.2.mandibular_breathing'].includes(key)) chosen = '4.6.end_of_life';
    if (key === '1.1.drug_psychiatric' || key === '1.1.polypharmacy') chosen = '4.4.adverse_effects';
  } else if (legacy.root === '2') {
    if (key.startsWith('2.3')) {
      const cm: Record<string,string> = { assessment:'2.2.assessment',strengths:'2.2.strengths',care_plan:'2.3.care_plan',
        service_meeting:'2.3.service_meeting',monitoring:'2.3.monitoring',discharge:'2.3.transition',resources:'2.3.coordination',supervision:'2.1.team' };
      chosen = cm[key.split('.').at(-1)!];
      if (!chosen) chosen = ['assessment','needs'].includes(legacy.attribute_id) ? '2.2.assessment' :
        ['ethical','principles'].includes(legacy.attribute_id) ? '2.1.independence' : '2.3.coordination';
      if (/認定調査.*委託/.test(details) || (/委託/.test(details) && /認定調査/.test(stem))) chosen = '1.3.assessment_survey';
    } else if (key.startsWith('2.1')) {
      const ethical: Record<string,string> = { decision:'self_determination',consent:'self_determination',privacy:'privacy',
        fairness:'fairness',advocacy:'role' };
      chosen = caseManager ? '2.1.' + (ethical[key.split('.').at(-1)!] ?? 'independence') :
        key.endsWith('.privacy') ? '5.1.privacy' : '5.1.principles';
    } else if (key.startsWith('2.2')) chosen = hit(social, label) ?? '5.1.interview';
    else chosen = hit(social, label) ?? hit(care, label) ?? hit(clinical, label);
  }

  // A named source concept is stronger evidence than isolated words in a case.
  // Only broad/unresolved source concepts use proposition text to split their scope.
  const broad = broadLegacy.has(key) || key.startsWith('provisional.');
  if (broad) {
    const text = knowledge || p;
    let target: string | undefined;
    if (legacy.root === '1' || key === '2.4') target = hit(care, text) ?? hit(clinical, text) ?? hit(social, text);
    if (['3.1','3.1.home','3.1.facilities','3.1.preventive','3.1.community'].includes(key)) target = hit(serviceRules, details + ' ' + stem);
    if (target) use(target, '広い旧概念を命題の判定対象・出題文脈で分割（語だけの推定は要確認）', !knowledge);
    else if (key.startsWith('provisional.')) {
      target = hit(social, label) ?? hit(care, label) ?? hit(clinical, label) ?? hit(serviceRules, label);
      if (target) use(target, '旧暫定概念の対象をトップダウン仮案へ対応（意味レビュー未確定）', true);
    }
  }
  if (key === '2.1') {
    const prefix = caseManager ? '2.1.' : '5.1.';
    const text = details;
    if (/褥瘡|体位変換/.test(text)) use('4.1.pressure_ulcer','支援原則の旧分類に混じった褥瘡予防の具体知識',true);
    else if (/守秘|個人情報|秘密|同意.*情報|同意.*近所|近所.*伝え|本人.*同意.*家族/.test(text)) use(prefix+'privacy','情報共有・秘密保持を原則一般から分離',!knowledge);
    else if (/中立|公平|公正|同一法人|差別/.test(text)) use(caseManager?'2.1.fairness':'5.1.principles','公正中立・差別禁止の知識',!knowledge);
    else if (/自己決定|本人の希望|本人の意向|利用者.*選択|意思決定|本人.*意思/.test(text)) use(caseManager?'2.1.self_determination':'5.1.principles','意思決定・選択への支援を分離',!knowledge);
  }
  if (key === '2.2') {
    const target = hit([['5.1.privacy',/守秘|個人情報|秘密保持/],['5.1.intake',/インテーク/],
      ['5.1.process',/援助過程|支援計画|終結|相談援助過程/],['5.1.relationship',/援助関係|共感|自己覚知|信頼関係/],
      ['5.1.principles',/自己決定|個別化|非審判|受容|尊厳/],['5.1.difficult_cases',/支援困難/]],details);
    if(target)use(target,'広い相談援助概念を援助対象・過程に沿って分割',!knowledge);
  }
  if (key === '2.3' || key === '2.3.assessment') {
    const target = hit([['2.2.standard_items',/課題分析標準項目/],['2.2.preventive_assessment',/介護予防.*(?:アセスメント|課題分析)/],
      ['2.2.needs',/ニーズ|生活課題/],['2.2.strengths',/ストレングス|強み/],
      ['2.3.service_meeting',/サービス担当者会議/],['2.3.monitoring',/モニタリング|再アセスメント/],
      ['2.3.planning',/原案|計画.*同意|同意.*計画/]],details);
    if(target)use(target,'ケアマネジメントの具体的過程をトップダウン案へ分割',!knowledge);
  }

  // Explicit targets for broad service/administration metadata; no miscellaneous bin.
  if (!chosen && legacy.root === '3') {
    const text = details + ' ' + stem;
    if (/施設サービス計画|施設サービス/.test(label + text)) chosen = /食事代|理美容|利用者負担|領収/.test(p) ? '3.1.contract' : '3.6.facility_plan';
    if (/地域密着型サービス|地域密着型介護予防サービス/.test(label)) chosen = '3.7.community_rules';
    if (/介護予防支援|介護予防サービス.*計画|介護予防ケアプラン/.test(label + text)) chosen = '3.8.preventive_plan_rules';
    if (/指定居宅介護支援のケアマネジメント|居宅介護支援|居宅サービス計画/.test(label + text)) chosen = '3.8.home_plan_rules';
    if (/共生型|基準該当|フォーマルなサービス|フォーマルな.*サービス|法定区分/.test(label + text)) chosen = '3.1.classification';
    if (/被保険者証.*提示/.test(p)) chosen = '3.1.contract';
    if (/業務管理体制|自らサービスの質/.test(p)) chosen = '3.1.quality';
    if (/忠実に職務|利用者の保護者/.test(p)) chosen = '2.1.role';
    if (chosen) use(chosen, '広いサービス概念から具体的な法定対象・共通知識を分離', true);
  }
  if (key.startsWith('provisional.') && legacy.root === '4') {
    const target = hit([
      ['1.5.authority', /管理運営|連携責務/], ['1.5.provider_designation', /住宅改修給付の監督|住宅改修費に関する調査権|事業者の指定|指定基準/],
      ['1.5.limitation', /不正受給の徴収権限/], ['1.5.payment_review', /介護給付費.*審査委員会/],
      ['1.2.community_funding', /地域支援事業支援交付金/], ['1.2.second_premium', /総報酬割/],
      ['1.2.funding', /保険料負担割合/], ['1.1.reform', /制度改正/], ['1.4.limit', /支給限度基準額/],
      ['1.6.total_services', /介護保険給付と地域支援事業|介護予防給付と地域支援事業/], ['3.1.classification', /共生型/],
      ['3.8.home_support_office', /居宅介護支援/],
    ], label);
    if (target) use(target, '旧暫定概念の制度的対象を明示した移行', true);
  }
  if (!chosen && /高齢者の呼吸機能/.test(label)) use('4.1.aging', '高齢者の加齢性呼吸機能の知識', true);
  if (!chosen && /生活リズム/.test(label)) use('4.1.sleep', '生活リズム調整に関する知識', true);
  if (!chosen && /介護支援専門員と主治医の連携/.test(label)) use('2.3.transition', 'ケアマネと医療との連携', true);
  if (!chosen && /チームアプローチ/.test(label)) use('2.1.team', 'チームによる協働支援', true);

  // Explicit boundary rules apply even to named service concepts.
  if (chosen?.startsWith('3.') || (!chosen && ['3','4'].includes(legacy.root))) {
    if (legacy.attribute_id === 'designation' || institutionalDesignation.test(knowledge || p) || /指定|届け出|公示/.test(p) && key === '3.1.home') use('1.5.provider_designation', 'サービス固有基準ではなく行政による指定・監督が判定対象');
    if (/給付調整|医療保険.*給付|医療保険.*適用|介護保険.*優先|優先.*介護保険/.test(knowledge || p) || legacy.attribute_id === 'benefit_coordination')
      use('1.4.coordination', '医療保険等との給付調整は介護保険制度へ分離', !knowledge);
    if (chosen === '3.3.medical_day' && row.year >= 2016) use('3.7.medical_day', '2016年以降の療養通所介護は地域密着型へ移行（個別の当時基準は未検証）', true);
    if (chosen === '3.5.selection_system' && !/選択制|選択できる/.test(details)) {
      chosen = /販売/.test(knowledge || p) && !/貸与/.test(knowledge || p) ? '3.5.sale' : '3.5.rental'; review = true;
    }
  }
  if (chosen === '4.5.icf' && !/ICF|国際生活機能/.test(p + knowledge + stem)) {
    const corrected = hit(clinical, knowledge || p);
    if (corrected) use(corrected, '旧ICF概念に混入した疾患等の判定対象を分離', true);
  }
  if (chosen === '5.3.legal_guardianship') {
    if (/任意後見/.test(details)) use('5.3.voluntary_guardianship', '後見の種類から任意後見へ分離');
    else if (/審判|請求|申立|選任|報告|監督/.test(details)) use('5.3.guardianship_procedure', '後見の申立て・選任・監督手続を分離');
  }
  if (chosen === '5.3.abuse_definition' && /通報|立入|調査|保護|市町村.*権限/.test(details)) use('5.3.abuse_response', '虐待の類型と法定の通報・対応を分離');
  if (chosen === '1.3.care_levels' && legacy.attribute_id === 'tests') review = true;
  const decision = individual[propositionId(row)];
  if (decision) { chosen=decision[0]; reason=decision[1]; method='individual_review'; }
  if (!chosen) {
    chosen = hit(social, details) ?? hit(care, details) ?? hit(clinical, details) ?? hit(serviceRules, details + stem);
    if (chosen) use(chosen, '旧概念名では定まらず命題の対象から仮置き', true);
  }
  if (!chosen) throw new Error('No target concept for ' + propositionId(row) + ': ' + label + ' / ' + p);
  if (!smallConcepts.has(chosen)) throw new Error('Target missing from committed plan: ' + chosen);
  let attributeId = legacy.attribute_id, attributeLabel = legacy.attribute_label;
  const canonicalAttributeLabels: Record<string,string> = { validity:'有効期間・期限・更新', components:'事業構成・実施内容', statistics:'統計・動向' };
  attributeLabel = canonicalAttributeLabels[attributeId] ?? attributeLabel;
  if (legacy.attribute_resolution === 'unresolved' || attributeId.startsWith('unresolved')) {
    attributeId = 'unresolved'; attributeLabel = '属性の要確認'; review = true;
  }
  if (chosen.startsWith('3.') && /介護予防/.test(label) && !chosen.startsWith('3.8.')) {
    attributeId = 'preventive_' + attributeId; attributeLabel = '介護予防型：' + attributeLabel;
  }
  const groupedDisease = new Set(['4.2.vascular','4.2.stroke','4.2.neurological','4.2.respiratory','4.2.metabolic',
    '4.2.kidney_urinary','4.2.liver_digestive','4.2.cancer','4.2.musculoskeletal','4.2.infection','4.2.skin','4.2.sensory',
    '4.3.dementia','4.3.psychosis','5.5.housing','4.6.professional_practice','4.6.excretion_care','4.6.respiratory_care','4.6.dialysis_care']);
  if (!broad && groupedDisease.has(chosen) && label !== clean(smallConcepts.get(chosen)!.label)) {
    const qualifier = key.split('.').at(-1)!.replace(/[^a-z0-9_]/g, '_');
    attributeId = 'scope_' + qualifier + '_' + attributeId;
    attributeLabel = legacy.concept_label + '：' + attributeLabel;
  }
  const category = chosen.split('.').slice(0, 2).join('.');
  return { version:'5x28-v1', proposition_id:propositionId(row), root_id:category.split('.')[0], category_id:category,
    concept_id:chosen, attribute_id:attributeId, attribute_label:attributeLabel, method,
    reason, source_fingerprint:targetSourceFingerprint(row), legacy_drawer_id:legacy.id,
    candidate_concept_ids:[], review_required:review,
    // Preserve specificity when small legacy disease/house-type concepts are merged.
    ...(!broad && clean(smallConcepts.get(chosen)!.label) !== label ? { scope_qualifier:legacy.concept_label } : {}) };
}
