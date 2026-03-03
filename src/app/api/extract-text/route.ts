import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
  "application/msword", // .doc (legacy)
];

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "ファイルが選択されていません。" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "ファイルサイズは10MBまでです。" },
      { status: 400 }
    );
  }

  const name = (file.name || "").toLowerCase();
  const isDocx =
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/msword";
  const isTxt = name.endsWith(".txt") || file.type === "text/plain";

  if (!isDocx && !isTxt) {
    return NextResponse.json(
      { error: "Word（.docx）またはテキスト（.txt）ファイルを選択してください。Googleドキュメントは「ファイル → ダウンロード → Microsoft Word」で .docx に保存してからアップロードできます。" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || "").trim();
      return NextResponse.json({ text });
    }
    // .txt
    const text = buffer.toString("utf-8").trim();
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `テキストの抽出に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
