# Manta Mode Animations

Planetz AppHeader に表示されるマンタ（エイ）アニメーション。3 つのスタイルが用意されている。

LP の Manta デバイス画像（`apps/landing/public/desktop-robot.png`）を **トレースせず色と形だけ抽象化**したもの。トップダウンのエイ型シルエット（中央ボディ + 後退翼 + 頭部の角 + 尾）で、**ダークなギャラクシー地 + ステータスカラーのティール発光リム**という実機の見た目を踏襲する。泳ぎは上下スイム + 翼のはばたきで表現。

形状ジオメトリは 3 スタイルで共通（`manta-paths.ts`）、アニメーション/カラーのトークンも共通（`manta-status-tokens.ts`）。

## コンポーネント

### 1. `manta-anim.tsx` — Default
標準スタイル。ダークなギャラクシーグラデーションのボディ + ステータスカラーの発光リム + 星屑。

- Body: `--color-cat-panel` → `--color-cat-crust` のラジアルグラデーション（ギャラクシー地）
- Glow: ボディ外周をなぞる発光リム（ステータスカラー）が脈動
- 星屑: ボディ上に微小な点（galaxy finish）

**用途**: デフォルト表示

### 2. `manta-shimmer.tsx` — Galaxy Shimmer
Default にマンタ周囲を周回するスパークルを追加。「Planetz × Manta」デバイスのギャラクシーフィニッシュをより体現。

- Body / Glow: Default と同じ
- スパークル: 7 箇所のステータスカラー点が脈動

**用途**: アイキャッチ、ムード演出が必要な場面

### 3. `manta-wireframe.tsx` — Minimalist Wireframe
全て線描のみ。輪郭の発光ハロー + 内部の背骨/エラ風メッシュ。

- Body: 線描のみ（塗りなし）
- Glow: 輪郭をぼかした発光ハロー
- メッシュ: 背骨ライン + エラ風カーブ
- 落ち着いた、技術的な印象

**用途**: ミニマルなデザイン、アクセシビリティ重視

### 4. `manta-glide.tsx` — Right-swim Glide（SVG+CSS / 進捗向け）
**右（+X）を向き、側面から約30°傾けた 3/4 視点**で泳ぐ。前進サージ + はばたき + 発光脈動。プログレスバー（右進行）の文脈向け。`manta-glide-*.gif` の **SVG+CSS 実装版**で、テーマ自動追従・無段階シャープ・`prefers-reduced-motion` 対応・追加バイナリ0。背景スクロールは持たない（向きと前進だけで右進行を表現）。

- 傾き: `VIEW_TRANSFORM = scale(1 0.55) skewX(-12) rotate(90)`（GIF 版と同一）
- props: `status` / `height`（幅は 1.5× の横長で自動算出）
- ⚠️ はばたきの軸は `transform-box: view-box` 採用。静的 tilt の `<g>` 配下にあるため、**実ブラウザ（Electron/Chromium）で軸ズレが無いか最終確認**すること（静的ポーズはラスタライズ検証済）。

**用途**: タスクカードの進捗ヘッド、ローディング（GIF の代替・本実装の推奨）

---

## ステータス状態

全てのコンポーネントで同じステータス→アニメーション・カラーマッピング：

| Status  | Swim duration | Glow color | Token | Impression |
|---------|---------------|-----------|-------|-----------|
| `idle`     | 3.2s | Lavender (dim) | `--color-muted-strong` | リラックス、待機中 |
| `working`  | 1.0s | Sky cyan       | `--color-status-running` | アクティブ、処理中 |
| `waiting`  | 2.0s | Green          | `--color-status-completed` | ユーザー入力待機 |
| `error`    | 0.45s | Soft coral    | `--color-status-failed` | 警告、エラー（柔らかい珊瑚色） |

---

## GIF の生成

### ヘッダー用（俯瞰・不透明）

AppHeader 背景に合わせたプレビュー。上下に泳ぐ俯瞰図。

```
apps/desktop/public/
  manta-default.gif
  manta-shimmer.gif
  manta-wireframe.gif
```

```bash
pnpm generate:manta-gifs
```

各フレームは `manta-paths.ts` と同じジオメトリを `sharp` でラスタライズし、`--color-cat-base` 背景に合成して `gifenc` で GIF 化（status=working）。

スクリプト: `scripts/generate-manta-gifs.mjs`

### 泳ぎ用（右向き・3/4・透過）

LP の Manta 筐体（`apps/landing/public/desktop-robot.png`）をトレースせず、**右（+X）へ泳ぐ・やや傾いた 3/4 視点**の透過 GIF。既存 3 ファイルとは別名。

```
apps/desktop/public/
  manta-swim-default.gif
  manta-swim-shimmer.gif
  manta-swim-wireframe.gif
```

```bash
pnpm generate:manta-swim-gifs
```

スクリプト: `scripts/generate-manta-swim-gifs.mjs`（`sharp` + `gifenc`、ルート devDependencies）

### Orbit スピナー用（ローディング / 空状態・透過）

低密度面（ローディング・空状態）向け。**中央に俯瞰のマンタ（群れ＝squad の本体）を据え、その周囲を小さな惑星（指揮下のエージェント＝Planetz）が傾いた 3/4 軌道で周回**する。マンタは常に正位置で視認性が高く、`manta`／`orbit`／`planetz` の 3 メタファーを同時に体現する。ステータスごとに発光色を変えた 4 ファイル（色だけで状態を判別可能）。

設計意図: [docs/design/manta-mode-ui-design.md](../../../../../../docs/design/manta-mode-ui-design.md) §5.2「ローディング／空状態」。

6状態（§4.1）+ legacy `waiting`。各 GIF には `prefers-reduced-motion` 用の静止ポスター PNG（先頭フレーム）が 1:1 で付随する。

```
apps/desktop/public/
  manta-orbit-idle.gif            / .png   (lavender, slow)
  manta-orbit-listening.gif       / .png   (cyan, calm hover)
  manta-orbit-working.gif         / .png   (cyan, active)
  manta-orbit-waiting.gif         / .png   (green, legacy alias)
  manta-orbit-approve_routine.gif / .png   (green, safe approval)
  manta-orbit-approve_review.gif  / .png   (peach/orange, needs review)
  manta-orbit-error.gif           / .png   (coral, urgent)
```

```bash
pnpm generate:manta-orbit-gifs
```

スクリプト: `scripts/generate-manta-orbit-gifs.mjs`（`sharp` + `gifenc`）。GIF=120×120・透過・~77KB/枚、PNG ポスター=120×120・透過。ステータスごとに発光色＋再生速度（`speed`）が変わる（idle/listening は遅く、working/error は速い）。

### Glide（右泳ぎ）用 — orbit の代替デザイン案・透過

orbit 版の代替。**マンタが右（+X）を向き、側面から約30°傾けた 3/4 アングルで右へ泳ぐ**。プログレスバーが右へ進む文脈に合わせた向き。ループでも「右進行」に見えるよう、**マンタはその場で泳ぎ・背景の星屑/惑星を左へスクロール（パララックス）＋尾に航跡**で表現。横長キャンバス（168×84）。orbit と同じ 6状態+`waiting`、各 GIF に静止ポスター PNG が付随。

```
apps/desktop/public/
  manta-glide-idle.gif            / .png   (lavender, slow)
  manta-glide-listening.gif       / .png   (cyan, calm)
  manta-glide-working.gif         / .png   (cyan, active)
  manta-glide-waiting.gif         / .png   (green, legacy alias)
  manta-glide-approve_routine.gif / .png   (green, safe approval)
  manta-glide-approve_review.gif  / .png   (peach/orange, needs review)
  manta-glide-error.gif           / .png   (coral, urgent)
```

```bash
pnpm generate:manta-glide-gifs
```

スクリプト: `scripts/generate-manta-glide-gifs.mjs`。傾き角は `TILT_SCALE_Y`（≈30°）、向きは `VIEW_TRANSFORM` で調整可。**orbit 版と二択の評価用**であり、採用が決まれば一方へ寄せる想定。

---

## 使用方法

### React コンポーネント内

```tsx
import { MantaAnim } from '../skins/manta/manta-anim'
import { MantaShimmer } from '../skins/manta/manta-shimmer'
import { MantaWireframe } from '../skins/manta/manta-wireframe'

// Default style
<MantaAnim status="working" size={48} />

// Galaxy Shimmer
<MantaShimmer status="waiting" size={48} />

// Wireframe
<MantaWireframe status="error" size={48} />
```

### HTML / Markdown

GIF ファイルを直接参照：

```html
Use [`manta-public-assets.ts`](./manta-public-assets.ts) (`?url` imports from `apps/desktop/public`). Product favicon uses [`rendererPublicUrl`](../../lib/renderer-public-url.ts) (`src/renderer/public` only).
```

---

## カスタマイズ

### カラー変更

`manta-status-tokens.ts` の `MANTA_STATUS_ANIMATION_MAP` の `glowColor` を編集：

```tsx
// apps/desktop/src/renderer/src/skins/manta/manta-status-tokens.ts
working: { swim: 1.0, glow: 0.7, glowColor: 'var(--color-status-running)' },
```

### アニメーション速度変更

swim / glow duration を秒単位で調整：

```tsx
idle: { swim: 3.2, glow: 2.4, ... }, // 遅い
working: { swim: 1.0, glow: 0.7, ... }, // 速い
```

### サイズ変更

コンポーネント呼び出し時に `size` prop で指定：

```tsx
<MantaAnim status="working" size={64} />  // 64px
```

---

## 技術仕様

- **形状**: Top-down ビュー（俯瞰図）
- **アニメーション方法**: CSS `@keyframes` + SVG transform
- **レスポンシブ**: viewBox ベースのスケーラブル SVG
- **アクセシビリティ**: `prefers-reduced-motion` 対応（スタイルで追加予定）
