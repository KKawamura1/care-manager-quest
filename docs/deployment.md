# 配信と自動デプロイ

## GitHub Actions → Cloudflare Workers

GitHub `KKawamura1/care-manager-quest` のmainがソースの正本。mainへのPRマージ・直接pushで、既存の型チェック・単体テスト・本番ビルド・Chromium/WebKit E2Eを実行し、全て成功した場合だけCloudflareへ配信する。ChatGPTの自動タスクには依存しない。

`.github/workflows/ci.yml` のdeploy jobはvalidate jobに依存する。同一実行の `care-manager-quest-dist` をダウンロードし、再ビルドせず検証済みの静的ファイルをアップロードする。WorkerコードはそのコミットからWranglerでバンドルする。main以外・PR検証時はデプロイしない。デプロイを直列化し、直前のmain SHA照合で古い実行をスキップする。手動のworkflow_dispatchもmainで利用できる。

`CLOUDFLARE_DEPLOY_ENABLED=true` が設定されるまではdeploy jobをスキップし、既存CIを継続する。これをfalseにすれば自動配信を止められる。CloudflareのGit連携ビルドは併用せず、配信経路をGitHub Actionsに統一する。

## 初回セットアップ

この手順はCloudflareの所有者アカウントとGitHubリポジトリのSettingsから一度だけ行う。APIトークンをチャットやソースへ貼り付けない。

1. CloudflareアカウントでWorkersのworkers.devサブドメインを用意する。専用ドメインは不要。APIトークンを作成し、対象アカウントのWorkers Scriptsの編集権限を付与する（公式のEdit Cloudflare Workersテンプレートを対象アカウントへ限定）。アカウントIDも確認する。
2. GitHubリポジトリ → Settings → Secrets and variables → Actions → Secretsに以下を設定する。

   | Secret | 値 |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | 上記のAPIトークン |
   | `CLOUDFLARE_ACCOUNT_ID` | 配信先CloudflareのアカウントID |

3. 同じ画面のVariablesに `CLOUDFLARE_DEPLOY_ENABLED` = `true` を設定する。配信設定PRをmainにマージする（既にマージ済みならActions → Validate MVP → Run workflow → main）。最初のデプロイで `care-manager-quest` Workerが作られる。Access設定が空なので、URLを開いても503でアプリ・画像・JSを配信しない。これはセットアップ途中の状態。
4. Cloudflareの対象WorkerにCloudflare Accessを有効化する。WorkerのAccessタブ、またはSettings → Domains & Routesのworkers.dev側のAccess設定を利用する。許可ポリシーは利用者本人のメールアドレスだけに限定し、One-time PIN等で本人がログインできる状態にする。EveryoneやBypassポリシーは設定しない。対象のworkers.devホスト全体を保護する。
5. 作成されたAccessアプリケーションのApplication Audience（AUD）とZero Trustのteam domainを確認し、GitHub ActionsのVariablesに以下を設定する。CloudflareダッシュボードだけでWorker変数を変更すると次のCI配信で上書きされるため、GitHub Variablesを正本にする。

   | Variable | 値 |
   | --- | --- |
   | `CLOUDFLARE_ACCESS_TEAM` | `your-team.cloudflareaccess.com` の `your-team` 部分だけ |
   | `CLOUDFLARE_ACCESS_AUD` | 対象AccessアプリケーションのAUD |
   | `CLOUDFLARE_ACCESS_EMAIL` | 許可する本人のメールアドレス1件 |

6. GitHub Actions → Validate MVP → Run workflow → mainで再配信する。deploy jobのログに出る実際のworkers.dev URLでAccessログインし、○×学習と5択を確認する。以降はmain更新だけで自動配信される。

本環境からCloudflare所有者アカウントやGitHub Secretsを設定する権限はない。リポジトリの実装・ローカル検証と、アカウント設定後の実配信は別の完了条件になる。

## 本人限定配信

`wrangler.json` は全リクエストで `worker/index.ts` を先に呼び出す。WorkerはCloudflare AccessのJWTについて署名・issuer・AUD・有効期限・本人のメールアドレスを検証した後だけ `ASSETS.fetch` を呼ぶ。JS・問題画像も例外にしない。未設定は503、未認証・不正JWT・他人は403。URLを知っているだけではアプリへアクセスできない。Preview URLsは無効。

公開鍵は設定されたteam domainのHTTPS certsから取得し、joseのJWKSキャッシュを利用する。静的アセット経由では `ctx.access` が伝搬しないため、JWT検証を使用する。APIトークンは配信ジョブにのみ渡し、フロントエンドや生成Wrangler設定へ入れない。Accessの構成がない最初の配信も拒否するため、公開してから後で閉じる手順にはならない。

## 学習履歴の移行

既存Sites: https://care-manager-quest.kriver2135.chatgpt.site

Sitesは引き続き利用可能。Cloudflareへ移行するとURLのoriginが変わるため、localStorageは自動では引き継がれない。同じiPhone・ブラウザで、Sitesの「記録」から5択履歴JSON、「○×学習」から○×履歴JSONをそれぞれ書き出し、新URLの対応画面で読み込む。置換前プレビューを確認する。問題ID・保存形式・ゲームデータは変更しない。

## ロールバック

問題の変更をrevertするPRをmainへマージして、通常のCIから再配信する。任意の古いブランチを手動公開せず、GitHub mainと配信版の対応を維持する。Access設定が誤っている場合はアプリの配信を拒否する。

## ローカル検証

```sh
npm ci
npm run typecheck
npm test
npm run build
npx --no-install wrangler deploy --dry-run --outdir /tmp/care-manager-worker
```

dry-runはアカウントなしでWorkerのバンドルと配信設定を検証する。実CloudflareでのAccessログイン・到達性は上記セットアップ後に確認する。

## 公式資料（2026-10-11確認）

- GitHub ActionsからWorkersへ配信: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Static Assetsの配信順序: https://developers.cloudflare.com/workers/wrangler/configuration/#assets
- WorkersのAccess設定とctx.accessの制約: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Access JWTの検証: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
