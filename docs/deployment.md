# 配信と自動デプロイ

## Cloudflare Workers BuildsのGitHub連携

GitHub `KKawamura1/care-manager-quest` のmainがソースの正本。GitHubリポジトリはprivateを維持し、Cloudflareで配信する**Webサイトのみ一般公開**する。

Cloudflare Workers Buildsがmainへのマージ・pushを検知し、型チェック・単体テスト・本番ビルドが成功した場合にWorkerと静的アセットを自動配信する。ChatGPT自動タスクやGitHub Actionsのdeploy jobは使用しない。

GitHub ActionsのValidate MVPはPRと手動実行の検証用。Chromium/WebKit E2EはPR上で実施するが、CloudflareはGitHub Actionsの結果を待たないため、PRの検証成功を確認してから手動でmainへマージすること。mainへの直接pushにはE2Eのゲートがない。ただし、ユーザーが登録を依頼した解説JSONの新規追加は、[解説登録手順](register-explanation.md)の例外としてPR・人のレビューなしでmainへ直接コミットしてよい。この場合は登録用の軽量CIとCloudflareの自動検証に任せる。この例外を通常のコード変更に拡張しない。

## 無料枠

Workers BuildsのFreeプランには月3,000ビルド分の枠がある（2026-10-11時点）。Cloudflare Access / Zero Trustは**使用しない**。支払い情報登録のためにAccessを有効化する必要はない。Workers本体のリクエスト利用枠はビルド枠とは別。

## 現在の設定

| 項目 | 値 |
| --- | --- |
| リポジトリ | `KKawamura1/care-manager-quest`（private） |
| Worker名 | `care-manager-quest` |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm ci && npm run build:cloudflare` |
| Deploy command | `npm run deploy:cloudflare` |
| Node.js | 22（`.node-version`） |
| Build variable | `SKIP_DEPENDENCY_INSTALL=true` |
| Preview builds / Preview URLs | 無効 |
| Production Worker URL | `https://care-manager-quest.focusgate-kkawamura.workers.dev` |

## 一般公開への切り替え

1. この変更のPRでGitHub Actionsの検証が成功したら、mainへマージする。
2. Cloudflare → Workers & Pages → `care-manager-quest` → Deploymentsで、新しいmainが自動デプロイされ、成功するまで待つ。
3. Cloudflare → Worker → DomainsでProductionのworkers.dev URLをON、PreviewをOFFにする。既にONなら変更しない。
4. **Accessを設定しない。** Workerの認証必須コードは削除済みなので、新デプロイ後はログインなしで5択/○×学習を利用できる。シークレットやAccessのAUD/Team/Emailも不要。
5. SafariでURLを開き、画面・問題文・採点・履歴保存を確認する。

サイトを一般公開すると、問題文・正答・原本画像などの配信データは第三者にも閲覧・取得可能になる。試験問題の利用条件と権利表記（READMEの「出典と利用条件」）に注意する。学習履歴はブラウザのlocalStorageに保存し、サーバーに同期しない。**GitHubリポジトリ自体はprivateのまま**。

## 学習履歴の移行

既存Sites: https://care-manager-quest.kriver2135.chatgpt.site

Cloudflareへ移行するとoriginが変わるため、localStorageは自動で引き継がれない。同じiPhone・ブラウザで、Sitesの「記録」から5択履歴JSON、「○×学習」から○×履歴JSONを書き出し、新URLの対応画面で読み込む。読み込み前にプレビューを確認する。問題ID・保存形式・ゲームデータは変更しない。

## 停止とロールバック

自動配信の停止はWorker → Settings → BuildsでGit接続をDisconnectする。既存の配信は残る。変更を戻す場合はrevertするPRをmainにマージして再配信する。過去ビルドのRetryは古いコミットへ戻さないよう注意する。

## ローカル検証

```sh
npm ci
npm run build:cloudflare
npx --no-install wrangler deploy --dry-run --outdir /tmp/care-manager-worker
npx --no-install playwright install --with-deps chromium webkit
npm run test:e2e
```

## 公式資料

- Workers GitHub連携: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- ビルド環境: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
- 無料ビルド枠: https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
