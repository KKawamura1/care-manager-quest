/**
 * High-precision recovery of fact dimensions that were lost in early
 * (2005–2014) classifications. Use strong lexical evidence only.
 *
 * We are grouping *topics*, not deciding whether any assertion is correct.
 * Rules are scoped to a domain/concept. Missing cues remain reviewable.
 */
const clean = s => String(s??'').normalize('NFKC').replace(/\s+/g,'');
const make = (id,label) => ({id,label,resolution:'curated'});

const certificationRules = [
  [/主治医意見書/, 'physician_opinion','主治医意見書の記載・利用'],
  [/認定調査|認定に係る調査|基本調査|特記事項|一次判定|第1次判定|第１次判定|要介護認定等基準時間/, 'survey','認定調査・一次判定'],
  [/介護認定審査会|認定審査会|審査判定|二次判定|第2次判定/, 'committee','認定審査会・二次判定'],
  [/有効期間|更新認定|更新申請|認定の効力|効力は/, 'validity','認定の有効期間・効力'],
  [/特定疾病|第2号被保険者/, 'specific_diseases','第2号被保険者の特定疾病'],
  [/申請|転入|転出|認定の変更|要介護度を変更/, 'application','認定申請・変更手続'],
  [/要介護認定は|要介護度|介護の必要性|要介護状態区分/, 'purpose','要介護認定の評価対象・区分'],
];
const counsellingRules = [
  [/バイステック|七原則|7原則|個別化|受容|自己決定|非審判的|情緒的関与|感情表出/, 'principles','相談援助の基本原則'],
  [/面接|クライエント|傾聴|ラポール|オープンクエスチョン|クローズドクエスチョン|共感|面談|質問|言語的|非言語的|焦点化|明確化/, 'interview','面接・コミュニケーション技術'],
  [/インテーク|アセスメント|契約|援助の終結|終結後|援助過程|ケースワーク/, 'process','相談援助の過程'],
  [/集団援助|グループワーク|グループ活動/, 'group','集団援助'],
  [/地域援助|地域住民|住民組織化|コミュニティワーク/, 'community','地域援助'],
  [/権利擁護|成年後見|虐待|緊急保護/, 'advocacy','権利擁護・安全確保'],
  [/他機関|関係機関|社会資源|連携|ネットワーク/, 'coordination','関係機関・社会資源との連携'],
];
const careManagementRules = [
  [/アセスメント|課題分析|家族の介護力|利用者の状態を把握|情報収集/, 'assessment','課題分析・アセスメント'],
  [/居宅サービス計画|ケアプラン|施設サービス計画|介護予防サービス計画|原案/, 'care_plan','ケアプランの作成・内容'],
  [/サービス担当者会議|担当者会議|ケアカンファレンス/, 'service_meeting','サービス担当者会議'],
  [/モニタリング|再アセスメント|目標達成度|評価の実施/, 'monitoring','モニタリング・評価'],
  [/苦情|権利擁護|自己決定|本人の希望|本人の意向|本人意思|同意/, 'rights','利用者の意思・権利擁護'],
  [/入退院|退院|退所|主治医|訪問看護|関係機関|民生委員|地域包括|福祉事務所/, 'coordination','関係機関・サービスとの連携'],
  [/サービス調整|社会資源|訪問介護|通所介護|短期入所|サービスの選択/, 'resources','社会資源の調整・選択'],
  [/家族|介護者|負担軽減/, 'family_support','家族支援'],
];
const careTechRules = [
  [/服薬|薬剤|副作用|多剤|薬の|処方/, 'medication','薬剤・服薬管理'],
  [/経腸栄養|経管栄養|中心静脈栄養|胃瘻|胃ろう|栄養|食事|たんぱく質|タンパク質|嚥下|摂食|食欲|味覚/, 'nutrition','栄養・食事・摂食支援'],
  [/排泄|排便|排尿|尿失禁|便秘|カテーテル/, 'excretion','排泄ケア'],
  [/入浴|清拭|清潔|褥瘡|スキンケア/, 'hygiene','清潔保持・皮膚ケア'],
  [/人工呼吸|酸素療法|酸素濃度|外部バッテリー|アンビューバッグ/, 'respiratory','呼吸管理・医療機器'],
  [/感染予防|感染対策|消毒|手洗い|標準予防策/, 'infection_control','感染予防・標準予防策'],
  [/リハビリ|歩行訓練|運動療法|筋力トレーニング/, 'rehab','運動・リハビリテーション'],
  [/終末期|看取り|緩和ケア|ACP|アドバンス・ケア/, 'end_of_life','終末期ケア'],
  [/急変|窒息|止血|応急|誤嚥時|意識を失った/, 'emergency','急変・緊急時の対応'],
];
const providerRules = [
  [/人員配置|人員基準|常勤|専従|配置|従業者|管理者の資格|介護職員の人数/, 'staffing','人員配置'],
  [/設備|居室|面積|食堂|浴室|定員/, 'equipment','設備・定員基準'],
  [/加算|減算|報酬|請求|算定|費用/, 'fees','介護報酬・費用'],
  [/指定|更新|監督|認可|許可|届出/, 'designation','事業者の指定・監督'],
  [/運営基準|運営|提供拒否|秘密|記録|苦情|事故|身体拘束|感染対策/, 'operations','運営基準'],
  [/サービス計画|居宅サービス計画|ケアプラン|サービス担当者会議/, 'care_plan','サービス計画の作成・整合'],
  [/利用対象|利用できる|利用者|入所|要支援|要介護|対象者/, 'eligibility','サービスの利用対象・要件'],
  [/訪問|通い|宿泊|サービスの内容|提供する/, 'services','サービスの提供内容'],
];
const legalRules = [
  [/保険料|財源|財政|公費|納付金|交付金|徴収/, 'finance','財源・保険料'],
  [/市町村|都道府県|国の|国が|保険者|市町村長|指定権者|条例|権限/, 'authority','実施主体・権限'],
  [/申請|届け出|届出|認定手続|不服申立て|審査請求/, 'procedure','申請・手続'],
  [/有効期間|期限|年以内|時効|更新/, 'validity','期限・更新'],
  [/給付|支給|利用者負担|負担割合|対象サービス/, 'benefits','給付・負担'],
  [/事業の構成|事業内容|構成事業|必須事業|任意事業|包括的支援事業/, 'components','事業の構成・内容'],
  [/法第|制度の目的|基本理念|国民の努力|責務|基本方針/, 'principles','法定目的・理念・責務'],
  [/統計|人口|人数|推移|割合|増加|減少|2017年度末/, 'statistics','制度の統計・動向'],
];
const ruleFor = (rules, text) => {
  const hit=rules.find(([pattern])=>pattern.test(text));
  return hit ? make(hit[1],hit[2]) : null;
};

/**
 * Only use assertion content where path/attribute is broad and has no
 * meaningful distinguishing facet. Strong named words are checked in order;
 * ambiguous groups are still reviewed through a separate inference flag.
 */
export function inferAttributeFromProposition(row, concept) {
  const raw=clean(row.attribute), statement=clean(row.proposition||row.source_text);
  if (!statement) return null;
  const broad = raw===clean(concept.label) || !raw ||
    (concept.id==='4.1.certification' && /介護保険制度>要介護・要支援認定/.test(raw)) ||
    /^(?:.+>)?(相談援助|支援技術|具体的な支援技術|加齢・疾病・病態|ケアマネジメント|保険給付|介護保険制度|その他の法律・制度)$/.test(raw) ||
    /申請・調査・審査判定・有効期間|アセスメント・計画・調整・評価|疾病・症状・検査・治療|健康状態・生活機能|支援の原則・ケアマネジメント・相談援助|給付の対象・条件・限度・負担/.test(raw) ||
    // Old v1.1 data are broad, without an attribute at all.
    (/^[1-4]\./.test(raw) && raw.split('>').length<=2);
  if (!broad) return null;
  let result=null;
  if (concept.id==='4.1.certification') result=ruleFor(certificationRules,statement);
  else if (concept.id==='2.2') result=ruleFor(counsellingRules,statement);
  else if (concept.id==='2.3') result=ruleFor(careManagementRules,statement);
  else if (concept.id==='2.4') result=ruleFor(careTechRules,statement);
  else if (concept.root==='3') result=ruleFor(providerRules,statement);
  else if (concept.root==='4') result=ruleFor(legalRules,statement);
  else if (concept.root==='1') {
    const rules=[
      [/検査|検査値|診断|測定|血中|血清|血液|CT|MRI|画像所見|BMI/, 'tests','検査・診断'],
      [/感染経路|感染対策|予防|ワクチン/, 'prevention','予防・感染対策'],
      [/治療|投薬|服薬|薬剤|薬物療法|手術/, 'treatment','治療・薬剤'],
      [/リスク|危険因子|原因|発症要因/, 'risk','原因・危険因子'],
      [/症状|所見|みられる|表れる|疼痛|呼吸困難|障害|状態/, 'symptoms','病態・症状'],
    ];result=ruleFor(rules,statement);
  }
  return result ? {...result, resolution:'inferred', evidence:'proposition_keyword'} : null;
}

/** High confidence named disease mentions recover subjects lost to umbrella subjects. */
export function recoverDiseaseConcept(row,aliases) {
  if(row.primary_path?.[0]!=='1')return null;
  const text=clean(row.proposition||row.source_text);
  const found=new Map();
  for(const [key,record] of aliases){
    if(!key.startsWith('1|') || !record.id.startsWith('1.1.'))continue;
    const name=key.slice(2);
    if(name.length<3 || name.includes('健康') || name.includes('疾患') || name.includes('状態')||name.includes('栄養'))continue;
    if(text.includes(name)) found.set(record.id,record);
  }
  if(found.size!==1)return null;
  return {...[...found.values()][0],resolution:'inferred',source_subject:row.subject_concept,evidence:'one_named_disease'};
}
