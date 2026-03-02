/**
 * 会議メモ解析結果の型定義（Gemini JSON 出力と対応）
 */
export interface MeetingTask {
  assignee: string;
  task: string;
  due_date: string;
  status: string;
  notes: string;
}

export interface MeetingParseResult {
  decisions: string[];
  pending_items: string[];
  tasks: MeetingTask[];
  next_topics: string[];
  summary: string;
}

/** タスク一覧の並び順 */
export type TaskSortBy = "default" | "assignee" | "due_date";
