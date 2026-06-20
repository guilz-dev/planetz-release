/**
 * Static UI-verification data for Conversation Mode mock.
 *
 * This file holds only sample data — no behavior. It exists so designers and
 * implementers can exercise every visual state without a live backend.
 */
import type { ChatSelectOption, ChatThreadSummary, ChatTurn } from '../components/chat/chat-types'
import {
  CHAT_FORM_FALLBACK_BRANCH_OPTIONS,
  CHAT_FORM_FALLBACK_MODEL_OPTIONS,
  CHAT_FORM_FALLBACK_PROVIDER_OPTIONS,
} from '../lib/chat-form-option-fallbacks.js'

const now = Date.now()
const minutesAgo = (n: number) => new Date(now - n * 60_000).toISOString()

export const PLANETZ_WS = '/Users/kaz/product/planetz'
export const GUILZ_WS = '/Users/kaz/product/guilz'

export const CHAT_THREAD_FIXTURES: ChatThreadSummary[] = [
  {
    id: 'thr_provider_detection',
    title: 'Provider 設定の検出方法を調査',
    workspacePath: PLANETZ_WS,
    workspaceLabel: 'planetz',
    updatedAt: minutesAgo(4),
    hasActiveSession: true,
  },
  {
    id: 'thr_review_changes',
    title: '変更をレビュー',
    workspacePath: PLANETZ_WS,
    workspaceLabel: 'planetz',
    updatedAt: minutesAgo(38),
    hasActiveSession: false,
  },
  {
    id: 'thr_stop_button',
    title: '停止ボタンの設計を調査',
    workspacePath: PLANETZ_WS,
    workspaceLabel: 'planetz',
    updatedAt: minutesAgo(126),
    hasActiveSession: false,
  },
  {
    id: 'thr_desktop_robot',
    title: 'デスクトップロボとは？',
    workspacePath: GUILZ_WS,
    workspaceLabel: 'guilz',
    updatedAt: minutesAgo(310),
    hasActiveSession: false,
  },
]

export const CHAT_TURN_FIXTURES: Record<string, ChatTurn[]> = {
  thr_provider_detection: [
    {
      id: 't1',
      role: 'user',
      content: 'Provider の設定がどこで検出されているか調べたい。',
      createdAt: minutesAgo(6),
    },
    {
      id: 't2',
      role: 'assistant',
      content:
        '検出は実行時のランタイム検出と設定ファイルの2系統があります。\n\n- ランタイム検出: 利用可能な CLI を起動時に走査\n- 設定: `ui` 設定の許可プロバイダ一覧\n\nどちらの挙動を確認したいですか？',
      createdAt: minutesAgo(5),
    },
    {
      id: 't3',
      role: 'user',
      content: 'ランタイム検出の方。どのタイミングで走るのか知りたい。',
      createdAt: minutesAgo(4),
    },
  ],
  thr_review_changes: [
    {
      id: 't1',
      role: 'user',
      content: '今の変更をレビューして、リスクがありそうな箇所を挙げて。',
      createdAt: minutesAgo(40),
    },
    {
      id: 't2',
      role: 'assistant',
      content:
        '差分を確認しました。注意したい点は次の3つです。\n\n1. 状態の永続化キーがバージョン未更新\n2. エラー時のフォールバック分岐が未テスト\n3. i18n キーの追加漏れ',
      createdAt: minutesAgo(39),
    },
  ],
  thr_stop_button: [
    {
      id: 't1',
      role: 'user',
      content: '実行中タスクの停止ボタンの設計はどうなってる？',
      createdAt: minutesAgo(128),
    },
    {
      id: 't2',
      role: 'assistant',
      content: '停止は実行中ステータスのタスクにのみ表示され、確認なしで即時に停止要求を送ります。',
      createdAt: minutesAgo(127),
    },
  ],
  thr_desktop_robot: [
    {
      id: 't1',
      role: 'user',
      content: 'デスクトップロボの位置づけを一言で。',
      createdAt: minutesAgo(311),
    },
    {
      id: 't2',
      role: 'assistant',
      content: 'エッジ AI を載せた常駐エージェントで、ローカルでタスクを回す存在です。',
      createdAt: minutesAgo(310),
    },
  ],
}

export const CHAT_WORKSPACE_OPTIONS: ChatSelectOption[] = [
  { value: PLANETZ_WS, label: 'planetz' },
  { value: GUILZ_WS, label: 'guilz' },
]

export const CHAT_BRANCH_OPTIONS: ChatSelectOption[] = [...CHAT_FORM_FALLBACK_BRANCH_OPTIONS]

export const CHAT_PROVIDER_OPTIONS: ChatSelectOption[] = [...CHAT_FORM_FALLBACK_PROVIDER_OPTIONS]

export const CHAT_MODEL_OPTIONS: ChatSelectOption[] = [...CHAT_FORM_FALLBACK_MODEL_OPTIONS]

/** Canned assistant replies so the mock send round-trip feels alive. */
export const MOCK_ASSISTANT_REPLIES: string[] = [
  '了解しました。もう少し詳しく教えてください。対象の範囲はどのあたりですか？',
  'なるほど。要件を整理すると次のようになりそうです。続けて詰めましょうか、それとも仕様にまとめますか？',
  'その方針で問題なさそうです。ほかに考慮すべき制約はありますか？',
]
