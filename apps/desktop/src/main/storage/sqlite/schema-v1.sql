CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_history (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  workflow TEXT,
  auto_decision_json TEXT,
  assigned_agent_id TEXT,
  issue_ref TEXT,
  submitted_task_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'discarded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prompt_history_created_at ON prompt_history(created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'system')),
  kind TEXT NOT NULL CHECK (kind IN ('initial_order', 'retry', 'resume', 'revise', 'note')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_task_created_at ON conversations(task_id, created_at);

CREATE TABLE IF NOT EXISTS retry_contexts (
  task_id TEXT PRIMARY KEY,
  origin_task_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retry', 'resume', 'revise')),
  prompt TEXT,
  branch TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_history (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  use_count INTEGER NOT NULL,
  PRIMARY KEY (provider, model)
);
CREATE INDEX IF NOT EXISTS idx_model_history_last_used_at ON model_history(last_used_at DESC);

CREATE TABLE IF NOT EXISTS effort_history (
  provider TEXT NOT NULL,
  effort TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  use_count INTEGER NOT NULL,
  PRIMARY KEY (provider, effort)
);
CREATE INDEX IF NOT EXISTS idx_effort_history_last_used_at ON effort_history(last_used_at DESC);

CREATE TABLE IF NOT EXISTS mock_tasks (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mock_tasks_status_updated_at ON mock_tasks(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS chain_groups (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_pr_links (
  task_id TEXT PRIMARY KEY,
  branch TEXT NOT NULL,
  repo TEXT NOT NULL,
  number INTEGER NOT NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
  is_draft INTEGER NOT NULL,
  base_branch TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
