"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { MeetingParseResult, MeetingTask, TaskSortBy } from "@/types/meeting";
import { SAMPLE_MEETING_MEMO } from "@/lib/sampleMemo";

const STORAGE_KEY = "gijiroku-app-last-input";

function buildMarkdown(data: MeetingParseResult, taskSort: TaskSortBy): string {
  const tasks = sortTasks(data.tasks, taskSort);
  const lines: string[] = [];
  lines.push("# 会議メモ整理結果\n");
  lines.push("## 要約\n" + (data.summary || "（なし）") + "\n");
  lines.push("## 決定事項\n");
  data.decisions.forEach((d) => lines.push("- " + d));
  lines.push("\n## 未決事項・保留事項\n");
  data.pending_items.forEach((p) => lines.push("- " + p));
  lines.push("\n## タスク一覧\n");
  tasks.forEach((t) => {
    lines.push(`- **${t.assignee}** / ${t.due_date} / ${t.status}: ${t.task}`);
    if (t.notes) lines.push(`  - 補足: ${t.notes}`);
  });
  lines.push("\n## 次回確認事項\n");
  data.next_topics.forEach((n) => lines.push("- " + n));
  return lines.join("\n");
}

/** Googleドキュメントなどに貼り付ける用のプレーンテキスト（まとめてコピー用） */
function buildDocumentText(data: MeetingParseResult, taskSort: TaskSortBy): string {
  const tasks = sortTasks(data.tasks, taskSort);
  const lines: string[] = [];
  lines.push("会議メモ整理結果");
  lines.push("");
  lines.push("【要約】");
  lines.push(data.summary || "（なし）");
  lines.push("");
  lines.push("【決定事項】");
  data.decisions.forEach((d) => lines.push("・" + d));
  lines.push("");
  lines.push("【未決事項・保留事項】");
  data.pending_items.forEach((p) => lines.push("・" + p));
  lines.push("");
  lines.push("【タスク一覧】");
  tasks.forEach((t) => {
    lines.push(`・${t.assignee} / ${t.due_date} / ${t.status}: ${t.task}`);
    if (t.notes) lines.push("　補足: " + t.notes);
  });
  lines.push("");
  lines.push("【次回確認事項】");
  data.next_topics.forEach((n) => lines.push("・" + n));
  return lines.join("\n");
}

function buildTasksCsv(tasks: MeetingTask[]): string {
  const header = "担当者,タスク,期限,状態,補足\n";
  const rows = tasks.map((t) =>
    [
      `"${(t.assignee ?? "").replace(/"/g, '""')}"`,
      `"${(t.task ?? "").replace(/"/g, '""')}"`,
      `"${(t.due_date ?? "").replace(/"/g, '""')}"`,
      `"${(t.status ?? "").replace(/"/g, '""')}"`,
      `"${(t.notes ?? "").replace(/"/g, '""')}"`,
    ].join(",")
  );
  return header + rows.join("\n");
}

function sortTasks(tasks: MeetingTask[], sortBy: TaskSortBy): MeetingTask[] {
  if (sortBy === "assignee") {
    return [...tasks].sort((a, b) => (a.assignee || "").localeCompare(b.assignee || ""));
  }
  if (sortBy === "due_date") {
    return [...tasks].sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  }
  return tasks;
}

function Section({
  title,
  children,
  onCopy,
  content,
}: {
  title: string;
  children: React.ReactNode;
  onCopy: () => void;
  content: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-800">{title}</h3>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!content}
          className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      <div className="min-h-[2rem] whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<MeetingParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskSort, setTaskSort] = useState<TaskSortBy>("default");
  const [documentCopyDone, setDocumentCopyDone] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setInput(saved);
      else setInput(SAMPLE_MEETING_MEMO);
    } catch {
      setInput(SAMPLE_MEETING_MEMO);
    }
  }, []);

  const saveInput = () => {
    try {
      if (input.trim()) localStorage.setItem(STORAGE_KEY, input);
    } catch {
      /* ignore */
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setExtractLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ファイルの読み込みに失敗しました。");
        return;
      }
      if (typeof data.text === "string") {
        setInput(data.text);
        saveInput();
      }
    } catch {
      setError("ファイルの読み込み中にエラーが発生しました。");
    } finally {
      setExtractLoading(false);
      e.target.value = "";
    }
  };

  const handleParse = async () => {
    const text = input.trim();
    if (!text) {
      setError("会議メモを入力してください。");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "解析に失敗しました。");
        setResult(null);
        return;
      }
      setResult(data as MeetingParseResult);
      saveInput();
    } catch (e) {
      setError("通信エラーです。ネットワークを確認して再度お試しください。");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const sortedTasks = useMemo(
    () => (result ? sortTasks(result.tasks, taskSort) : []),
    [result, taskSort]
  );

  const tasksByAssignee = useMemo(() => {
    const map = new Map<string, MeetingTask[]>();
    sortedTasks.forEach((t) => {
      const key = t.assignee || "未特定";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries());
  }, [sortedTasks]);

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  const fullMarkdown = result ? buildMarkdown(result, taskSort) : "";
  const fullDocumentText = result ? buildDocumentText(result, taskSort) : "";

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-800">
      <header className="border-b border-zinc-200 bg-white py-4">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-xl font-semibold tracking-tight">会議メモ整理</h1>
          <p className="mt-1 text-sm text-zinc-500">
            会議メモ・文字起こしを貼り付けて解析し、決定事項・タスク・次回確認事項に整理します
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="memo" className="text-sm font-medium text-zinc-700">
                会議メモ（貼り付けまたはファイルから読み込み）
              </label>
              <span className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label="Wordまたはテキストファイルを選択"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extractLoading}
                  className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {extractLoading ? "読み込み中..." : "Word / テキストをアップロード"}
                </button>
              </span>
            </div>
            <p className="mb-2 text-xs text-zinc-500">
              Googleドキュメントは「ファイル → ダウンロード → Microsoft Word（.docx）」で保存してからアップロードできます。
            </p>
            <textarea
              id="memo"
              rows={12}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="会議メモをここに貼り付け..."
              className="w-full resize-y rounded border border-zinc-300 bg-white px-4 py-3 text-sm leading-relaxed text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleParse}
                disabled={loading}
                className="rounded bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
              >
                {loading ? "解析中..." : "解析する"}
              </button>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600" role="alert">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-zinc-500 underline hover:text-zinc-700"
                  >
                    閉じる
                  </button>
                </div>
              )}
            </div>
          </div>

          {result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-3 shadow-sm">
                <span className="text-sm font-medium text-zinc-600">出力</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(fullDocumentText);
                      setDocumentCopyDone(true);
                      setTimeout(() => setDocumentCopyDone(false), 2000);
                    }}
                    className="rounded bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    {documentCopyDone ? "コピーしました" : "まとめてコピー（Googleドキュメント用）"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fullMarkdown)}
                    className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                  >
                    全体をMarkdownでコピー
                  </button>
                  <a
                    href={`data:text/markdown;charset=utf-8,${encodeURIComponent(fullMarkdown)}`}
                    download="meeting-notes.md"
                    className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                  >
                    Markdownでダウンロード
                  </a>
                  <a
                    href={`data:text/csv;charset=utf-8,${encodeURIComponent(buildTasksCsv(result.tasks))}`}
                    download="tasks.csv"
                    className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                  >
                    タスクをCSVでダウンロード
                  </a>
                </div>
              </div>

              {result.summary && (
                <Section
                  title="要約"
                  content={result.summary}
                  onCopy={() => copyToClipboard(result.summary)}
                >
                  {result.summary}
                </Section>
              )}

              <Section
                title="決定事項"
                content={result.decisions.join("\n")}
                onCopy={() => copyToClipboard(result.decisions.join("\n"))}
              >
                {result.decisions.length ? result.decisions.map((d, i) => <div key={i}>・{d}</div>) : "（なし）"}
              </Section>

              <Section
                title="未決事項・保留事項"
                content={result.pending_items.join("\n")}
                onCopy={() => copyToClipboard(result.pending_items.join("\n"))}
              >
                {result.pending_items.length
                  ? result.pending_items.map((p, i) => <div key={i}>・{p}</div>)
                  : "（なし）"}
              </Section>

              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-zinc-800">
                    タスク一覧
                    {taskSort === "due_date" && "（期限順アクション一覧）"}
                    {taskSort === "assignee" && "（担当者別）"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">並び順:</span>
                    <select
                      value={taskSort}
                      onChange={(e) => setTaskSort(e.target.value as TaskSortBy)}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700"
                    >
                      <option value="default">元の順</option>
                      <option value="assignee">担当者別</option>
                      <option value="due_date">期限順</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          sortedTasks
                            .map(
                              (t) =>
                                `${t.assignee}\t${t.task}\t${t.due_date}\t${t.status}${t.notes ? "\t" + t.notes : ""}`
                            )
                            .join("\n")
                        )
                      }
                      className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      コピー
                    </button>
                  </div>
                </div>
                <div className="min-h-[2rem] text-sm text-zinc-700">
                  {sortedTasks.length ? (
                    <ul className="space-y-2">
                      {sortedTasks.map((t, i) => (
                        <li key={i} className="flex flex-wrap gap-x-2 gap-y-1">
                          <span className="font-medium">{t.assignee}</span>
                          <span className="text-zinc-500">{t.due_date}</span>
                          <span className="text-zinc-500">{t.status}</span>
                          <span>{t.task}</span>
                          {t.notes && <span className="text-zinc-500">（{t.notes}）</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "（なし）"
                  )}
                </div>
              </div>

              {taskSort === "assignee" && tasksByAssignee.length > 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-base font-semibold text-zinc-800">担当者別タスク一覧</h3>
                  <div className="space-y-4">
                    {tasksByAssignee.map(([assignee, tasks]) => (
                      <div key={assignee}>
                        <h4 className="mb-1 text-sm font-medium text-zinc-600">{assignee}</h4>
                        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-700">
                          {tasks.map((t, i) => (
                            <li key={i}>
                              {t.due_date} / {t.status}: {t.task}
                              {t.notes && ` （${t.notes}）`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Section
                title="次回確認事項"
                content={result.next_topics.join("\n")}
                onCopy={() => copyToClipboard(result.next_topics.join("\n"))}
              >
                {result.next_topics.length
                  ? result.next_topics.map((n, i) => <div key={i}>・{n}</div>)
                  : "（なし）"}
              </Section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
