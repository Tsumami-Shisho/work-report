# 作業報告メモアプリ セットアップ手順書

スマホだけでセットアップ可能です。所要時間は約20〜30分。

---

## 全体の流れ

```
① Supabase でDB＋認証を作る（無料）
② GitHub にコードを置く
③ Vercel でデプロイ（無料）
④ スマホのホーム画面に追加
```

---

## ① Supabase セットアップ

### 1. アカウント作成

1. スマホのブラウザで https://supabase.com にアクセス
2. 「Start your project」→ GitHubアカウントでサインアップ
3. 「New Project」をタップ
4. 以下を入力：
   - **Name**: `work-report`（何でもOK）
   - **Database Password**: 安全なパスワードを設定（メモしておく）
   - **Region**: `Northeast Asia (Tokyo)` を選択
5. 「Create new project」をタップ → 2分ほど待つ

### 2. APIキーを取得

1. 左メニュー →「Settings」→「API」
2. 以下の2つをメモ：
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbG...` で始まる長い文字列

### 3. テーブルを作成

1. 左メニュー →「SQL Editor」
2. 「New Query」をタップ
3. 以下のSQLをコピー＆ペーストして「Run」：

```sql
-- 作業報告テーブル
CREATE TABLE work_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  work_type TEXT NOT NULL,
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, report_date, hour)
);

-- インデックス（高速化）
CREATE INDEX idx_reports_user_date ON work_reports(user_id, report_date);

-- RLS（行レベルセキュリティ）を有効化
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

-- ポリシー：自分のデータだけ操作可能
CREATE POLICY "Users can view own reports"
  ON work_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON work_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON work_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON work_reports FOR DELETE
  USING (auth.uid() = user_id);
```

4. 「Success」と表示されればOK

### 4. メール認証の設定（任意）

1. 左メニュー →「Authentication」→「Providers」
2. 「Email」が有効になっていることを確認
3. テスト段階では「Confirm email」をOFFにすると、メール確認なしですぐログインできて便利

---

## ② GitHub にコードを配置

### スマホからの方法

**方法A：GitHub.com のWeb UIを使う（おすすめ）**

1. https://github.com にアクセス → ログイン
2. 「+」→「New repository」
3. Repository name: `work-report`、Public でOK → Create
4. 「creating a new file」リンクをタップ
5. 以下のファイルを1つずつ作成：

各ファイルの作成手順：
- ファイル名を入力（例：`index.html`）
- 内容をペースト
- 「Commit changes」

作成するファイル一覧：
| ファイル名 | 内容 |
|-----------|------|
| `index.html` | HTMLファイル |
| `style.css` | CSSファイル |
| `app.js` | メインロジック |
| `supabase-config.js` | ★ここにAPIキーを入れる |
| `vercel.json` | ルーティング設定 |
| `manifest.json` | PWA設定 |
| `package.json` | プロジェクト設定 |

**重要：`supabase-config.js` を編集**

```javascript
const SUPABASE_URL = 'https://あなたのプロジェクトID.supabase.co';
const SUPABASE_ANON_KEY = 'あなたのanonキー';
```

手順②でメモした値に置き換えてください。

---

## ③ Vercel でデプロイ

1. スマホブラウザで https://vercel.com にアクセス
2. 「Sign Up」→ GitHubアカウントで登録
3. 「Add New...」→「Project」
4. 「Import Git Repository」で `work-report` を選択
5. **Framework Preset**: `Other` を選択
6. 「Deploy」をタップ
7. 1分ほどで完了 → URLが発行される

例：`https://work-report-xxxx.vercel.app`

このURLがあなたのアプリのアドレスです。

---

## ④ スマホのホーム画面に追加

### iPhone（Safari）
1. デプロイされたURLにアクセス
2. 共有ボタン（□に↑）をタップ
3. 「ホーム画面に追加」
4. 「追加」

### Android（Chrome）
1. デプロイされたURLにアクセス
2. メニュー（⋮）→「ホーム画面に追加」
3. 「追加」

これでアプリアイコンからワンタップで起動できます。

---

## 使い方

### スマホ（外出先）
1. アプリを開く → ログイン
2. 時間帯をタップ → 作業種類を選んで一言メモ → 保存
3. 「☁️ 同期済」が出ればOK
4. 通知を許可すると毎時リマインド

### PC（サマリー確認）
1. 同じURLにブラウザでアクセス
2. 同じアカウントでログイン
3. 「📊 サマリー」をクリック
4. 日別の作業レポートが一覧表示

---

## トラブルシューティング

| 問題 | 対処法 |
|------|--------|
| ログインできない | Supabaseの「Authentication」→「Confirm email」がOFFか確認 |
| データが保存されない | ブラウザの開発者ツールでコンソールエラーを確認。APIキーが正しいか再確認 |
| 通知が来ない | ブラウザの通知設定を確認。iOS Safariは16.4以降＋ホーム画面追加が必要 |
| PCとスマホでデータが違う | サマリー画面の「🔄 更新」ボタンを押す |

---

## 無料枠の目安

| サービス | 無料枠 | このアプリでの消費 |
|---------|--------|------------------|
| Supabase | DB 500MB、認証ユーザー無制限 | 1人1日9件 × 365日 でも数MBレベル |
| Vercel | 月100GBの帯域 | 個人〜小チームなら余裕 |
| GitHub | 無制限パブリックリポジトリ | 問題なし |

個人やチームでの利用なら、無料枠を超えることはまずありません。

---

## セキュリティについて

- **RLS（行レベルセキュリティ）** が有効なので、各ユーザーは自分のデータしか見れません
- **anon key** はブラウザに露出しますが、RLSがあるため安全です
- パスワードはSupabaseが暗号化して管理します
- 本番運用時はカスタムドメインとHTTPS（Vercelが自動対応）を使ってください
