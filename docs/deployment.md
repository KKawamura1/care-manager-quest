# 配信と自動デプロイ

## Cloudflare Workers BuildsのGitHub連携

GitHub `KKawamura1/care-manager-quest` のmainがソースの正本。CloudflareにGitHubリポジトリを接続すると、mainへのPRマージ・直接pushをCloudflareが検知し、Cloudflare側で型チェック・単体テスト・本番ビルドを実行する。全て成功したときだけ同じビルドのdistと認証Workerを自動配信する。ChatGPTの自動タスクやGitHub Actionsのdeploy jobは使わない。

GitHub ActionsのValidate MVPはPRと手動実行の検証用。型チェック・単体テスト・ビルド・Chromium/WebKit E2Eを維持し、main pushによる重複ビルドをなくす。Cloudflareの配信はGitHub Actionsの結果を待たないため、PRの検証成功を確認してから手動でmainへマージする。直接push時のCloudflareビルドではE2Eを実行しない。

## 無料枠

Workers BuildsのFreeプランには月3,000分のビルド枠、同時ビルド1件、1ビルド20分の上限がある（2026-10-11確認）。この構成のmainビルドと配信にはCloudflare側の枠を使う。GitHub ActionsのPR検証は別枠であり、privateリポジトリではGitHub側の利用枠を消費する。GitHub連携の有無とWorkers実行時の料金は別で、既存のAPI配信方式もそれ自体が有料限定だったわけではない。

## 初回セットアップ

PRをmainにマージした後、Cloudflareの所有者アカウントで一度だけ接続する。Pagesではなく、本人限定の認証Workerを維持するためWorkersのGitHub連携を使用する。

1. Cloudflare → Workers & Pages → Create application → Import a repository（画面によってはGitHub連携／Connect to GitHub）を選ぶ。API Tokensの画面ではない。
2. Cloudflare Workers & PagesのGitHub Appを許可し、Only select repositoriesで `KKawamura1/care-manager-quest` を指定する。
3. 以下を設定する。

   | 項目 | 設定 |
   | --- | --- |
   | Worker名／Project name | `care-manager-quest`（wrangler.jsonのnameと一致） |
   | Production branch | `main` |
   | Root directory | リポジトリ直下（空欄、または `/`） |
   | Build command | `npm ci && npm run build:cloudflare` |
   | Deploy command | `npm run deploy:cloudflare` |
   | Node.js | `.node-version` の22を使用 |
   | Build Variables and Secrets | `SKIP_DEPENDENCY_INSTALL` = `true` |
   | Non-production branch builds | 無効（本番mainのみ） |
   | API token | Cloudflareの自動生成設定を使用 |

   Cloudflareの自動インストールを止め、Build command内の `npm ci` でlockfileに従って依存関係をインストールする。
4. Save and Deployを押す。Access設定が空なので、最初のURLは503でアプリ・JS・画像を配信しない。これはセットアップ途中の状態。
5. 対象Worker → Settings → Buildsで、GitHubリポジトリ、production branch = main、非本番ブランチのビルド無効を確認する。以後mainへのマージで自動配信される。既存Workerがある場合はCreate applicationの代わりに、対象Worker → Settings → Builds → Connectから同じリポジトリを接続する。
6. WorkerのAccessタブ、またはSettings → Domains & Routesのworkers.dev側のAccess設定からCloudflare Accessを有効化する。許可ポリシーは本人のメールアドレスだけにし、One-time PIN等でログインできるようにする。workers.devホスト全体を保護する。EveryoneやBypassポリシーは使わない。
7. AccessアプリのApplication Audience（AUD）とZero Trustのteam domainを確認し、**Worker → Settings → Variables & Secrets（実行時変数）** に以下を追加する。Settings → Buildsのビルド変数ではない。

   | 実行時変数 | 値 |
   | --- | --- |
   | `ACCESS_TEAM` | `your-team.cloudflareaccess.com` の `your-team` 部分だけ |
   | `ACCESS_AUD` | 対象AccessアプリのAUD |
   | `ACCESS_EMAIL` | 本人のメールアドレス1件 |

8. 変数の変更を保存・Deployし、実際のworkers.dev URLでAccessログイン、○×学習、5択を確認する。`keep_vars: true` により、次のGit連携デプロイでもこれらのダッシュボード変数を維持する。

GitHub Secrets・Variablesは不要。旧手順で登録済みの `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_DEPLOY_ENABLED`、`CLOUDFLARE_ACCESS_*` は参照しない。Cloudflare側の接続・認証設定は所有者による初回操作が必要であり、PRのマージだけでは接続が完了しない。

## 本人限定配信

`wrangler.json` は全リクエストで `worker/index.ts` を先に呼び出す。WorkerはCloudflare AccessのJWT署名・issuer・AUD・有効期限・本人メールを検証した後だけ `ASSETS.fetch` を呼ぶ。JS・問題画像も対象。未設定は503、未認証・不正JWT・他人は403。Preview URLsは無効。

公開鍵は設定されたteam domainのHTTPS certsから取得し、joseのJWKSキャッシュを利用する。設定前にアプリを公開する手順にはならない。APIトークンはCloudflareのビルド接続で管理し、ソースやフロントエンドには入れない。

## 学習履歴の移行

既存Sites: https://care-manager-quest.kriver2135.chatgpt.site

Cloudflareへ移行するとURLのoriginが変わるため、localStorageは自動では引き継がれない。同じiPhone・ブラウザで、Sitesの「記録」から5択履歴JSON、「○×学習」から○×履歴JSONをそれぞれ書き出し、新URLの対応画面で読み込む。置換前プレビューを確認する。問題ID・保存形式・ゲームデータは変更しない。

## 停止とロールバック

自動配信の停止はCloudflareの対象Worker → Settings → BuildsでGit接続をDisconnectする。既存の配信は残る。変更を戻す場合はrevertするPRをmainへマージし、Git連携で再配信する。Cloudflareの過去ビルドをRetryするときは古いコミットを意図せず本番に戻さないよう対象を確認する。

## ローカル検証

```sh
npm ci
npm run build:cloudflare
npx --no-install wrangler deploy --dry-run --outdir /tmp/care-manager-worker
npx --no-install playwright install --with-deps chromium webkit
npm run test:e2e
```

dry-runはアカウントなしでWorkerのバンドルと配信設定を検証する。実CloudflareでのGit接続、デプロイ、Accessログインは初回セットアップ後に確認する。

## 公式資料（2026-10-11確認）

- Workers GitHub連携: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- 新規・既存Workerの接続: https://developers.cloudflare.com/workers/ci-cd/builds/
- ビルド設定: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- ビルド環境・Node・依存インストール: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
- 無料ビルド枠: https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- 実行時変数の維持（keep_vars）: https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth
- WorkersのAccess設定: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Access JWT検証: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
