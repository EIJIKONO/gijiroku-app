import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MeetingParseResult } from "@/types/meeting";

const JSON_SCHEMA_INSTRUCTION = `
以下のJSON形式のみで回答してください。説明文やマークダウンは一切含めないでください。
{
  "decisions": ["決定事項1", "決定事項2"],
  "pending_items": ["未決・保留1", "未決・保留2"],
  "tasks": [
    {
      "assignee": "担当者名（不明なら「未特定」)",
      "task": "タスク内容",
      "due_date": "期限（不明なら「期限未設定」、曖昧な日付はそのまま記載)",
      "status": "未着手|進行中|完了|要確認",
      "notes": "補足（なければ空文字)"
    }
  ],
  "next_topics": ["次回確認事項1", "次回確認事項2"],
  "summary": "会議の要約（1-2文)"
}
`;

const EXTRACTION_RULES = `
【抽出ルール】
- 担当者が明記されていない場合は「未特定」
- 期限が明記されていない場合は「期限未設定」
- 決定事項と単なる意見・議論は区別する。決定したことだけをdecisionsに含める
- 推測しすぎず、本文に根拠がある内容を優先する
- 曖昧な点は「要確認」としてstatusに記載する
- 日付表現が曖昧な場合はそのまま表示し、無理に日付変換しない（例：「3月半ば」「来週」はそのまま）
`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(
      { error: "APIキーが設定されていません。.env.local に GEMINI_API_KEY を設定してください。" },
      { status: 503 }
    );
  }

  let body: { text: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストボディが不正です。" },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "会議メモのテキストが空です。メモを入力してください。" },
      { status: 400 }
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `${JSON_SCHEMA_INSTRUCTION}
${EXTRACTION_RULES}

以下の会議メモを解析し、上記JSON形式で出力してください。

--- 会議メモ ---
${text}
--- ここまで ---`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const response = result.response;
    if (!response.text()) {
      return NextResponse.json(
        { error: "APIから有効な応答が得られませんでした。もう一度お試しください。" },
        { status: 502 }
      );
    }

    const raw = response.text().trim();
    const parsed = JSON.parse(raw) as MeetingParseResult;

    if (!Array.isArray(parsed.decisions)) parsed.decisions = [];
    if (!Array.isArray(parsed.pending_items)) parsed.pending_items = [];
    if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
    if (!Array.isArray(parsed.next_topics)) parsed.next_topics = [];
    if (typeof parsed.summary !== "string") parsed.summary = "";

    parsed.tasks = parsed.tasks.map((t) => ({
      assignee: typeof t.assignee === "string" ? t.assignee : "未特定",
      task: typeof t.task === "string" ? t.task : "",
      due_date: typeof t.due_date === "string" ? t.due_date : "期限未設定",
      status: typeof t.status === "string" ? t.status : "要確認",
      notes: typeof t.notes === "string" ? t.notes : "",
    }));

    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    if (message.includes("API key") || message.includes("403") || message.includes("401")) {
      return NextResponse.json(
        { error: "APIキーが無効です。.env.local の GEMINI_API_KEY を確認してください。" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: `解析に失敗しました: ${message}。もう一度お試しください。` },
      { status: 502 }
    );
  }
}
