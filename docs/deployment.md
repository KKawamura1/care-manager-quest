# 配信

## 今回のプレビュー

非公開プレビュー： https://care-manager-quest.kriver2135.chatgpt.site

Sitesでビルド済み静的ファイルを配信します。ユーザー本人向けのprivateアクセスを保持します。プレビュー側のソースは配信のためのスナップショットで、編集の正本はGitHub `KKawamura1/care-manager-quest` です。今後の変更はGitHub PRで行い、その結果からプレビューを更新します。mainには自動マージしません。

ブラウザ履歴はorigin単位です。ローカル開発URLとプレビュー、将来のPages URLを移動するときはJSONを書き出して読み込んでください。

## Cloudflare Pages継続デプロイ案

サーバー処理のないVite静的出力なので、Cloudflare PagesのGitHub連携で配信できます。

1. Cloudflare側で対象のprivate GitHubリポジトリへのアクセスを許可。
2. 本番ブランチをmain、ビルドコマンドを `npm ci && npm run build`、出力を `dist` に設定。
3. private GitHubとサイトのアクセス制御は別。本人限定を維持するならCloudflare Access等を設定してから配信。
4. PRのプレビューでE2E・iPhone実機を確認し、手動マージ後に本番更新。

この環境ではCloudflareアカウントの連携・ドメイン・Access設定を確認できないため、その継続デプロイは今回構成していません。代替としてprivateプレビューと、Actionsのdist artifactを用意しています。フロントエンドへAPIキーを埋め込む必要はありません。

公式資料（確認日2026-10-10）：

- GitHub Actions private repoの利用枠: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Cloudflare Pages Vite出力: https://developers.cloudflare.com/pages/configuration/build-configuration/
