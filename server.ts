import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Google Gemini API clients securely on the server-side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Google GenAI client successfully initialized.");
  } catch (err) {
    console.error("Failed to initialize Google GenAI SDK client:", err);
  }
} else {
  console.log("No valid GEMINI_API_KEY provided. Server will run with offline fallbacks.");
}

// REST route to generate elegant immersion narration for events
app.post("/api/gemini/event-narration", async (req, res) => {
  try {
    if (!ai) {
      return res.json({ text: "" });
    }
    const { title, description, choiceText, outcomeOriginal } = req.body;
    
    const prompt = `あなたはダークファンタジーRPG『Rogue Vanguard』の不気味かつ神秘的なゲームマスター（ナレーター）です。日本のアニメやノベルゲーム風に、以下のイベント状況と選択肢・結末を、プレイヤーの没入感を極限まで高めるセリフやナレーション形式（130文字程度、日本語）で肉付けして一言解説してください。
イベント名: ${title}
本来の説明: ${description}
プレイヤーの選択: ${choiceText}
もたらされた結果: ${outcomeOriginal}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.8,
      }
    });

    res.json({ text: response.text?.trim() || "" });
  } catch (error: any) {
    console.error("Gemini events narration endpoint failed:", error);
    res.json({ text: "", isError: true });
  }
});

// REST route to generate live feedback from battles, keeping player strategy immersed
app.post("/api/gemini/battle-narration", async (req, res) => {
  try {
    if (!ai) {
      return res.json({ text: "" });
    }
    const { turn, enemyName, enemyAction, playerHp, playerFury, playerStance, logText } = req.body;
    
    const prompt = `あなたはハイクオリティで冷徹なダークファンタジー・カードゲーム実況解説員です。現在第${turn}ターン、先陣の勇士ヴァンガード（構え: ${playerStance}, 怒気: ${playerFury}/100, 残りHP: ${playerHp}）は「${enemyName}」と交戦中。
敵が予測した行動: 「${enemyAction}」
このターンにプレイヤーが引き起こしたログ: 「${logText}」
この激突を、中二病マインドがそそられる緊迫した戦況ルポ（90文字以内、日本語）に仕立て上げてください。`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.85,
      }
    });

    res.json({ text: response.text?.trim() || "" });
  } catch (error: any) {
    console.error("Gemini battle status narration failed:", error);
    res.json({ text: "", isError: true });
  }
});

// Setup dev server or fallback static bundle serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Express with Vite Hot Reload-safe connection...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving production builds for containerization...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express dev/prod server successfully listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
