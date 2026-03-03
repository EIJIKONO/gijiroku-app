# 会議メモ整理（gijiroku-app）

会議メモ・文字起こし・箇条書きを貼り付けると、Google Gemini で自動整理し、決定事項・未決事項・タスク・次回確認事項として見やすく表示する社内Webアプリです。ローカルPC上で動作します。

## 主な機能

- **入力**: 会議メモ・音声文字起こし・箇条書きをそのまま貼り付け
- **解析**: ボタン1つで Gemini API に送信し、構造化して取得
- **表示**: 決定事項 / 未決・保留 / タスク一覧 / 担当者別・期限順 / 次回確認事項
- **コピー**: 各セクション単位・全体を Markdown でコピー
- **エクスポート**: Markdown ファイル・タスクの CSV ダウンロード
- **ローカル保存**: 直近の入力1件をブラウザに保存（再訪問時に復元）
- **サンプル**: 初回はサンプル会議メモを表示

## 技術構成

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** でスタイル
- **Google Gemini 2.5 Flash**（`gemini-2.5-flash`）で解析
- APIキーはサーバー側のみ使用（クライアントに露出しません）

## セットアップ手順

### 1. リポジトリの取得

```bash
git clone <リポジトリURL>
cd gijiroku-app
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. APIキーの設定

`.env.example` をコピーして `.env.local` を作成し、Gemini API キーを設定します。

```bash
cp .env.example .env.local
```

`.env.local` を開き、取得した API キーを記述します。

```
GEMINI_API_KEY=あなたのAPIキー
```

APIキーは [Google AI Studio](https://aistudio.google.com/apikey) で取得できます。

### 4. 起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて利用します。

## 起動コマンド一覧

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動（推奨） |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番モードで起動（`build` 後） |
| `npm run lint` | ESLint 実行 |

**通常の利用では `npm run dev` の1コマンドで起動できます。**

## フォルダ構成

```
gijiroku-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── parse/
│   │   │       └── route.ts   # Gemini 解析 API
│   │   ├── layout.tsx
│   │   ├── page.tsx           # メイン画面
│   │   └── globals.css
│   ├── lib/
│   │   └── sampleMemo.ts      # サンプル会議メモ
│   └── types/
│       └── meeting.ts         # 解析結果の型定義
├── .env.example
├── .env.local                 # 要作成（Git に含めない）
├── netlify.toml               # Netlify ビルド設定
├── package.json
├── README.md
└── tsconfig.json
```

## 使い方

1. トップページのテキストエリアに会議メモを貼り付ける（サンプルが入っている場合はそのまま試すか、書き換えてください）。
2. **解析する** ボタンをクリックする。
3. 結果が「要約」「決定事項」「未決事項」「タスク一覧」「次回確認事項」などに分かれて表示されます。
4. 各ブロックの **コピー** でクリップボードにコピー。**全体をMarkdownでコピー** で一括コピー。
5. **Markdownでダウンロード** / **タスクをCSVでダウンロード** でファイル保存。
6. タスク一覧は「担当者別」「期限順」で並び替え可能です。

## Netlify にデプロイする

1. **GitHub などにリポジトリをプッシュ**しておく。
2. [Netlify](https://app.netlify.com/) にログインし、**Add new site > Import an existing project** でリポジトリを選択。
3. **Build settings** はそのままでOK（`netlify.toml` で指定済み）。
4. **環境変数を設定**  
   **Site configuration > Environment variables** で以下を追加：
   - **Key**: `GEMINI_API_KEY`
   - **Value**: あなたの Gemini API キー
   - **Scopes**: すべて（または Production など必要なもの）
5. **Deploy site** でデプロイ。完了後、表示された URL でアプリにアクセスできます。

※ API キーは Netlify の環境変数にだけ設定し、リポジトリには含めないでください。

## 注意事項

- APIキーは `.env.local`（ローカル）または Netlify の環境変数にのみ記載し、Git にコミットしないでください。
- 社内利用を想定しており、ログイン機能やデータベースはありません。
- 入力はブラウザのローカルストレージに直近1件だけ保存されます。

## ライセンス

社内利用を想定したプロジェクトです。
