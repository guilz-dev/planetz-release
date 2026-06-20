# インストール

> Status: はじめに · 対象バージョン 0.1.x

---

Planetz Agent Deck を macOS に入れるいちばん簡単な方法は、GitHub Releases から `dmg` をダウンロードすることです。

## ダウンロード

- 最新リリースのページ: [https://github.com/guilz-dev/planetz-release/releases/latest](https://github.com/guilz-dev/planetz-release/releases/latest)
- 直接ダウンロード: [https://github.com/guilz-dev/planetz-release/releases/latest/download/Planetz-Agent-Deck.dmg](https://github.com/guilz-dev/planetz-release/releases/latest/download/Planetz-Agent-Deck.dmg)

公開済みの Release がまだない場合は、リンク先で 404 になります。その場合は配布担当者に最新リリースの公開状況を確認してください。

## インストール手順

1. 上のリンクから `Planetz-Agent-Deck.dmg` をダウンロードします。
2. ダウンロードした `dmg` を開きます。
3. 表示されたウィンドウで `Planetz Agent Deck.app` を `Applications` フォルダへドラッグします。
4. コピーが終わったら `dmg` を取り出します。
5. `Applications` から `Planetz Agent Deck` を開きます。

## 初回起動

初回起動時に macOS が確認を求めることがあります。

- そのまま開ける場合は通常どおり進めます。
- 「開けません」と表示された場合は、アプリを右クリックして `開く` を選ぶか、`システム設定 > プライバシーとセキュリティ` から許可します。

配布用に署名・公証された DMG であれば、通常はそのまま起動できます。ローカルで作成した未署名 DMG は、別の Mac で Gatekeeper に止められることがあります。

## 追加のセットアップは必要ですか？

通常は不要です。Planetz Agent Deck の `dmg` には、実行に必要な bundled orbit と Node が含まれています。`takt` や Node.js を別途インストールしなくても使える想定です。

## 更新方法

新しい版に更新するときは、最新の `dmg` をダウンロードして、`Applications` 内の `Planetz Agent Deck.app` を置き換えます。
