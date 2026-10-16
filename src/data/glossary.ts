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
export const glossaryTerms: readonly GlossaryTerm[] = [
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
