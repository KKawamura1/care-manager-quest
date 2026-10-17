import type { GlossaryTerm } from '../domain/glossary';

const service = 'https://www.kaigokensaku.mhlw.go.jp/commentary/service.html';
const publish = (group: number) => `https://www.kaigokensaku.mhlw.go.jp/publish/group${group}.html`;
const entry = (label: string, description: string, sourceUrl = service, aliases: string[] = []): GlossaryTerm =>
  ({ id: label, label, description, sourceUrl, aliases });

// Short editorial summaries of the linked public sources, checked 2026-10-17.
// Definitions describe the term, not whether an exam statement is correct.
const services: GlossaryTerm[] = [
  entry('居宅介護支援', '在宅の要介護者のケアプランを作り、サービス事業者などと連絡・調整する支援。', publish(1)),
  entry('訪問介護', 'ホームヘルパーが自宅を訪れ、食事・排泄などの身体介護や、調理・掃除などの生活援助を行うサービス。', publish(2), ['ホームヘルプ']),
  entry('訪問入浴介護', '浴槽を積んだ車などで自宅を訪れ、入浴を支援するサービス。', publish(3)),
  entry('訪問看護', '看護師などが自宅を訪れ、主治医の指示に基づいて療養生活を支えるサービス。', publish(4)),
  entry('訪問リハビリテーション', 'リハビリの専門職が自宅を訪れ、心身機能の維持・回復や生活の自立を支援するサービス。', publish(5)),
  entry('居宅療養管理指導', '医師・歯科医師・薬剤師などが自宅を訪れ、療養上の管理や助言を行うサービス。'),
  entry('通所介護', '施設に日帰りで通い、食事・入浴などの支援や機能訓練を受けるサービス。', publish(7), ['デイサービス']),
  entry('通所リハビリテーション', '病院や老健などに日帰りで通い、生活の自立に向けたリハビリを受けるサービス。', publish(8), ['デイケア']),
  entry('短期入所生活介護', '施設に短期間泊まり、食事・入浴などの日常生活の介護や機能訓練を受けるサービス。', publish(12)),
  entry('短期入所療養介護', '老健や介護医療院などに短期間泊まり、医療・看護・介護やリハビリを受けるサービス。', publish(13)),
  entry('特定施設入居者生活介護', '有料老人ホームなどの入居者に、計画に基づいて日常生活の介護や機能訓練を提供するサービス。', publish(17)),
  entry('福祉用具貸与', '車いすや特殊寝台など、日常生活の自立を助ける福祉用具を借りるサービス。', publish(21)),
  entry('特定福祉用具販売', '入浴や排泄などに使う、貸与になじまない福祉用具の購入を支える仕組み。', publish(22)),
  entry('定期巡回・随時対応型訪問介護看護', '定期的な訪問と必要時の対応を組み合わせ、介護・看護で在宅生活を支える地域密着型サービス。', publish(23)),
  entry('夜間対応型訪問介護', '夜間の定期訪問や通報に応じた訪問で、在宅での介護を支える地域密着型サービス。'),
  entry('地域密着型通所介護', '小規模な通所施設で日常生活の支援や機能訓練を提供する地域密着型サービス。'),
  entry('療養通所介護', '常時看護師の観察が必要な重度の要介護者などに、日帰りで看護・介護を提供するサービス。'),
  entry('認知症対応型通所介護', '認知症の人が日帰りで通い、日常生活の介護や機能訓練を受ける地域密着型サービス。'),
  entry('小規模多機能型居宅介護', '「通い」を中心に「訪問」「宿泊」を組み合わせ、在宅生活を支える地域密着型サービス。'),
  entry('看護小規模多機能型居宅介護', '通い・宿泊・訪問介護に訪問看護を組み合わせ、介護と看護を一体的に提供するサービス。', publish(24)),
  entry('認知症対応型共同生活介護', '認知症の人が少人数で共同生活を送り、日常生活の介護などを受ける地域密着型サービス。', publish(18), ['グループホーム']),
  entry('地域密着型特定施設入居者生活介護', '小規模な有料老人ホームなどで、入居者に介護や機能訓練を提供する地域密着型サービス。'),
  entry('地域密着型介護老人福祉施設入所者生活介護', '定員29人以下の特養で、入所者に日常生活の介護などを提供する地域密着型サービス。'),
];
const preventiveLabels = ['訪問入浴介護', '訪問看護', '訪問リハビリテーション', '居宅療養管理指導', '通所リハビリテーション', '短期入所生活介護', '短期入所療養介護', '特定施設入居者生活介護', '福祉用具貸与', '認知症対応型通所介護', '小規模多機能型居宅介護', '認知症対応型共同生活介護'];
const law = 'https://www.mhlw.go.jp/web/t_doc?dataId=82998034&dataType=0';
const standards = 'https://www.mhlw.go.jp/web/t_doc?dataId=82999404&dataType=0';
const guardianship = 'https://www.moj.go.jp/MINJI/a01.html';
const additions: GlossaryTerm[] = [
  entry('保険者', '保険制度を運営する側。介護保険では市町村・特別区が担う。「被保険者」は制度に加入する側。', law),
  entry('被保険者', '保険制度に加入して保障を受ける立場の人。介護保険では第1号と第2号に分かれる。運営する側の「保険者」と区別する。', law),
  entry('第1号被保険者', '介護保険に加入する65歳以上の人。40〜64歳の医療保険加入者である第2号被保険者と区別する。', law, ['第一号被保険者']),
  entry('第2号被保険者', '介護保険に加入する40〜64歳の医療保険加入者。介護保険の給付には、要介護・要支援の原因が特定疾病であることが必要。', law, ['第二号被保険者']),
  entry('指定', '行政が法令に基づいて対象に一定の位置付けを与えること。介護サービスでは、基準を満たした事業者等を保険給付の対象として認める手続。', law),
  entry('許可', '行政が法令に基づいて事業などを認めること。介護保険では、老健・介護医療院の開設は許可の対象で、サービス事業者の指定と区別する。', law),
  entry('条例', '地方公共団体が議会の議決を経て定める地域の法規。介護保険では保険料や事業者の基準などにも用いられる。', law),
  entry('人員基準', '必要な職種、職員数、資格などについての基準。「設備基準」は建物・設備、「運営基準」はサービス提供の進め方に関する基準。', standards),
  entry('設備基準', '事業所・施設に必要な部屋、面積、設備などについての基準。職員配置に関する人員基準と区別する。', standards),
  entry('運営基準', '説明・同意、計画作成、記録、苦情対応など、適切なサービス提供の進め方についての基準。', standards),
  entry('人員・設備・運営基準', '職員配置、建物・設備、サービス提供の進め方についての基準の総称。指定や許可を受ける際や、事業を続ける際に守る。', standards, ['人員、設備及び運営に関する基準']),
  entry('地域支援事業', '市町村が行う、介護予防や地域での自立生活を支える事業の枠組み。総合事業、包括的支援事業、任意事業からなる。', 'https://www.mhlw.go.jp/web/t_doc?dataId=82998034&dataType=0&pageNo=4'),
  entry('介護予防・日常生活支援総合事業', '地域支援事業の一つ。要支援者等への訪問・通所などの支援と、地域の高齢者に向けた一般介護予防事業を行う。略称は「総合事業」。', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000192992.html', ['総合事業']),
  entry('事業対象者', '基本チェックリスト等により、総合事業の介護予防・生活支援サービス事業の対象となると判断された人。要支援認定とは別の仕組み。', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000192992.html'),
  entry('普通徴収', '介護保険では、納付書や口座振替などで市町村に保険料を納める方法。年金から差し引く特別徴収と区別する。', 'https://www.mhlw.go.jp/wp/hakusyo/kousei/25-2/dl/10.pdf'),
  entry('特別徴収', '介護保険では、一定の要件を満たす第1号被保険者の年金から保険料を差し引き、市町村に納める方法。', 'https://www.mhlw.go.jp/wp/hakusyo/kousei/25-2/dl/10.pdf'),
  entry('区分支給限度基準額', '要介護度などに応じて定める、居宅サービス等の保険給付の上限の基準。対象サービスで上限を超えた分は原則全額自己負担。高額介護サービス費の自己負担上限とは別。', 'https://www.kaigokensaku.mhlw.go.jp/help/page6.html'),
  entry('高額介護サービス費', '介護サービスの対象となる自己負担が月の上限を超えたとき、超過分を支給する仕組み。食費・居住費などは原則として計算の対象外。', 'https://www.kaigokensaku.mhlw.go.jp/commentary/fee.html'),
  entry('嚥下', '「えんげ」。食べ物や唾液などを飲み込み、胃へ送ること。気道に入り込む「誤嚥」とは異なる。', 'https://www.tyojyu.or.jp/kankoubutsu/gyoseki/shokuji-eiyo-kokucare/h31-3-1-3.html'),
  entry('誤嚥', '「ごえん」。食べ物・飲み物・唾液などが、食道ではなく気道に入り込むこと。必ずむせるとは限らない。', 'https://www.tyojyu.or.jp/kankoubutsu/gyoseki/shokuji-eiyo-kokucare/h31-3-1-3.html'),
  entry('褥瘡', '「じょくそう」。身体の一部に圧迫などが続き、皮膚やその下の組織が傷つくこと。いわゆる床ずれ。', 'https://www.tyojyu.or.jp/net/byouki/rounensei/haiyo-shokogun.html', ['床ずれ']),
  entry('せん妄', '急に注意力や意識の状態が乱れ、症状が時間によって変動する状態。慢性的な認知機能低下である認知症と区別するが、両者が重なる場合もある。', 'https://www.tyojyu.or.jp/net/byouki/rounensei/senmou.html'),
  entry('廃用症候群', '長い安静や活動の低下によって、筋力低下、関節の拘縮など、さまざまな心身機能の低下が生じること。', 'https://www.tyojyu.or.jp/net/byouki/rounensei/haiyo-shokogun.html'),
  entry('拘縮', '「こうしゅく」。筋肉や関節周囲の組織などの変化により、関節を動かせる範囲が狭くなること。単に筋力が落ちることとは異なる。', 'https://www.tyojyu.or.jp/net/byouki/rounensei/haiyo-shokogun.html'),
  entry('認知症', '脳の障害により認知機能が持続的に低下し、日常生活・社会生活に支障が出ている状態。単なる加齢による物忘れや、急に変動するせん妄と区別する。', 'https://www.ncgg.go.jp/dementia/about/answer.html'),
  entry('認知症の行動・心理症状', '認知症に伴って生じる不安、抑うつ、幻覚、妄想、興奮などの症状。BPSDとも呼ばれ、記憶障害などの認知機能障害とは区別する。', 'https://www.ncgg.go.jp/hospital/iryokankei/letter/111.html', ['BPSD', '行動・心理症状']),
  entry('パーキンソン病', '動作が遅くなる、筋肉がこわばる、安静時にふるえる、姿勢を保ちにくいなどの運動症状を主とする神経の病気。', 'https://www.nanbyou.or.jp/entry/169'),
  entry('筋萎縮性側索硬化症', 'ALS。運動をつかさどる神経が障害され、手足や飲み込み・呼吸などの筋肉の力が徐々に低下する病気。', 'https://www.nanbyou.or.jp/entry/52', ['ALS']),
  entry('成年後見制度', '判断能力が不十分な人を、財産管理や契約などの法律面で支える制度。法定後見と任意後見があり、実際の介護を行う制度とは異なる。', guardianship),
  entry('法定後見', '判断能力が不十分になった人について、家庭裁判所が選任する後見人・保佐人・補助人が法律面を支援する仕組み。', guardianship, ['法定後見制度']),
  entry('任意後見', '十分な判断能力があるうちに、将来の支援者と任せる事務を公正証書で契約する仕組み。判断能力が低下し、家庭裁判所が監督人を選任すると効力が生じる。', guardianship, ['任意後見制度']),
  entry('日常生活自立支援事業', '判断能力が不十分な人を、本人との契約に基づき、福祉サービスの利用や日常的な金銭管理などで支える事業。契約内容を判断できる能力が必要。', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/seikatsuhogo/chiiki-fukusi-yougo/index.html'),
  entry('介護扶助', '生活保護の扶助の一つで、必要な介護サービスの費用を保障するもの。介護保険料などを扱う生活扶助とは区別する。', 'https://www.mhlw.go.jp/content/12002000/001588227.pdf'),
];
export const glossaryTerms: readonly GlossaryTerm[] = [
  ...additions,
  ...services,
  ...preventiveLabels.map(label => {
    const original = services.find(item => item.label === label)!;
    return entry(`介護予防${label}`, `介護予防を目的とするサービス。${original.description}`, original.sourceUrl);
  }),
  entry('特定介護予防福祉用具販売', '介護予防を目的に、入浴や排泄などに使う特定福祉用具の購入を支える仕組み。'),
  entry('介護予防支援', '要支援者の介護予防サービスなどの利用計画を作り、事業者との連絡・調整を行う支援。'),
  entry('介護予防ケアマネジメント', '総合事業で、要支援者や事業対象者の生活上の課題を把握し、介護予防に向けた支援の計画・調整を行うこと。', 'https://www.mhlw.go.jp/web/t_doc?dataId=00tc1081&dataType=1', ['第1号介護予防支援事業']),
  entry('介護老人福祉施設', '常時介護を必要とする人が暮らし、日常生活の介護などを受ける施設。一般に「特養」と呼ばれる。', 'https://www.kaigokensaku.mhlw.go.jp/care_services_guide/care_services_guide_service17.html', ['特別養護老人ホーム', '特養']),
  entry('介護老人保健施設', '医学的な管理、介護、リハビリなどを提供し、在宅復帰を支援する施設。', publish(15), ['老健']),
  entry('介護医療院', '長期療養が必要な人に、医療と日常生活の介護を一体的に提供する生活の場。', publish(26)),
  entry('介護保険施設', '介護保険の施設サービスを提供する、指定介護老人福祉施設・介護老人保健施設・介護医療院の総称。'),
  entry('地域密着型サービス', '住み慣れた地域で暮らし続けるためのサービスの枠組み。原則として、その市町村の住民が利用する。', 'https://www.kaigokensaku.mhlw.go.jp/publish/'),
  entry('地域包括支援センター', '高齢者の総合相談、権利擁護、介護予防などを担う地域の相談・支援拠点。', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/chiiki-houkatsu/'),
  entry('介護認定審査会', '認定調査や主治医意見書などを基に、介護の必要度を専門的に審査・判定する合議体。', 'https://www.mhlw.go.jp/topics/kaigo/nintei/gaiyo1.html'),
  entry('介護保険審査会', '要介護認定や保険料などの行政処分への不服申立てを審査する、都道府県に置かれる機関。', 'https://www.fukushi.metro.tokyo.lg.jp/kourei/hoken/kaigo_lib/yokyu'),
  entry('国民健康保険団体連合会', '介護給付費の審査・支払や、介護サービスに関する苦情対応などを担う団体。', 'https://www.tokyo-kokuhoren.or.jp/nursing_office/index.html', ['国保連合会', '国保連']),
  entry('要介護認定', '介護が必要な状態か、どの程度必要かを市町村が認定する手続き。', 'https://www.mhlw.go.jp/topics/kaigo/nintei/gaiyo1.html'),
  entry('介護支援専門員', '本人の状況や希望を踏まえてケアプランを作り、サービス利用を調整する専門職。', publish(1), ['ケアマネジャー', 'ケアマネージャー', 'ケアマネ']),
  entry('ケアマネジメント', '本人の生活上の課題や希望を踏まえ、必要な支援を組み合わせ、計画・調整・見直しを継続すること。', 'https://www.mhlw.go.jp/web/t_doc?dataId=00tc1081&dataType=1'),
  entry('ケアプラン', '本人の希望や生活上の課題を踏まえ、支援の目標や利用するサービスなどをまとめた計画。', publish(1), ['居宅サービス計画', '施設サービス計画', '介護予防サービス計画']),
  entry('アセスメント', '本人の心身の状態や暮らしを把握し、支援が必要な課題を整理・分析すること。', publish(1), ['課題分析']),
  entry('モニタリング', '計画に沿った支援の実施状況や本人の変化を確認し、見直しの必要性を検討すること。', 'https://www.mhlw.go.jp/web/t_doc?dataId=00tc1081&dataType=1'),
  entry('サービス担当者会議', '利用者を支える関係者が情報を共有し、ケアプランや支援内容を検討する会議。', publish(1)),
  entry('手段的日常生活動作', '買い物・調理・金銭管理など、地域で暮らすための応用的な生活動作。', 'https://www.pharm.or.jp/words/adl.html', ['IADL']),
  entry('日常生活動作', '食事・着替え・排泄・入浴・移動など、日々の生活に必要な基本動作。', 'https://www.pharm.or.jp/words/adl.html', ['ADL']),
  entry('理学療法士', '立つ・歩くなどの基本動作の回復を、運動や物理的な手段で支援するリハビリの専門職。', 'https://www.mhlw.go.jp/web/t_doc?dataId=80038000&dataType=0&pageNo=1'),
  entry('作業療法士', '生活に関わる作業活動を通じて、心身の機能回復や日常生活への参加を支援する専門職。', 'https://www.mhlw.go.jp/web/t_doc?dataId=80038000&dataType=0&pageNo=1'),
  entry('言語聴覚士', 'ことば・聞こえ・飲み込みなどに障害がある人を、訓練や助言で支援する専門職。', 'https://www.hokeniryo.metro.tokyo.lg.jp/iryo/shikaku/minasanhe/kakusyoku/gengo'),
  entry('身体介護', '食事・排泄・入浴など、利用者の身体に直接触れて行う介護など。', publish(2)),
  entry('生活援助', '掃除・洗濯・調理など、日常生活に必要な家事を支える援助。', publish(2)),
];
