# 画面構成の概要

> Status: 製品紹介 · 対象バージョン 0.1.x ｜ ラベルは実機で確認のこと

## このページでわかること

Planetz デスクトップアプリのレイアウト——どこに何があるかを素早く掴むために。このセクションの以降のページは、この画面の各部分を拡大して説明します。

---

## まずワークスペースを開く

Planetz はワークスペース——**Open workspace**（ワークスペースを開く）で開く Git リポジトリ——の上で動きます。Planetz は自身の状態をプロジェクトの傍らのサイドカーに保持し、実行時にあなたの既存ツールのデータには書き込みません（[Git 連携](../concepts/git-integration.md) を参照）。初回起動時は短いセットアップ（既定の **Provider** と **Model**）を案内します。

## 3 つの領域

Deck は 3 つの領域でできています。

1. **左レール — ビュー。** 縦のレールで主ビューを切り替えます。主なビューは：

   | ビュー | 用途 |
   |---|---|
   | **Task** | 作業を投入して見る → [タスク Deck](task-deck.md) |
   | **Issue** | GitHub の issue をキューに取り込む |
   | **Spec Studio** | 意図を起草・トレース → [Spec Studio](spec-studio.md) |
   | **Decisions** | エージェントの決定をレビュー → [Decisions](decisions.md) |
   | **Workflows** | プロセスのカタログを見る → [ワークフロー](workflows.md) |
   | **Log** | 実行ログ → [ログとサマリー](logs-and-summary.md) |
   | **Summary** | 実行サマリー（結果） → [ログとサマリー](logs-and-summary.md) |
   | **Adapter** | 外部エージェントの接続 *（Experimental）* |

2. **中央 — アクティブなビュー。** レールで選んだもの：タスクボード、会話、Spec Studio など。

3. **パネル — 艦隊を一目で。** ドック可能なパネルが **Agents**（エージェント）と **Tasks**（タスク）を作業の傍らに表示し、**Add task**（タスクを追加）で新規投入できます。ヘッダーには **Workspace**・**View**・**Panels**・**Reset layout** と **Settings** があります。

## 任意のコンパニオン

**Manta** デスクトップロボがあれば、同じ艦隊状態（working / waiting / approve / error）をアンビエントライトと LCD で映し、物理的な Approve / Deny を提供します。Planetz は Manta なしでも画面上で完全に動きます。[エッジ AI とデータ主権](../concepts/edge-ai.md) を参照。

## 次に読む

- [タスク Deck](task-deck.md) — 最も長く使うビュー。
- [全体像とメンタルモデル](../concepts/overview.md) — これらのビューが背後のループにどう対応するか。
