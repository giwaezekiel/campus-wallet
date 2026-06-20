import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware";
import { Expense } from "../model/expense.model";
import { Budget } from "../model/budget.model";
import { config } from "../../shared/config/config";

type ChatMessage = { role: "user" | "model"; content: string };

// Allow overriding the model via env. gemini-2.5-flash is current and free-tier
// friendly; the 1.5 models are retired. Switch with GEMINI_MODEL if needed.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// Build a snapshot of the user's current-month finances to ground the AI's answers.
async function buildFinancialContext(userId: string): Promise<string> {
  const month = new Date().toISOString().slice(0, 7);
  const start = new Date(`${month}-01`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

  const expenses = await Expense.find({
    user: userId,
    date: { $gte: start, $lt: end },
  }).sort({ date: -1 });

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  const budgets = await Budget.find({ user: userId, month });
  const budgetLines = budgets.map((b) => {
    const spent = byCategory[b.category] ?? 0;
    const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
    return `- ${b.category}: spent ₦${spent.toLocaleString()} of ₦${b.limit.toLocaleString()} (${pct}%)`;
  });

  return [
    `Month: ${month}`,
    `Total spent this month: ₦${total.toLocaleString()}`,
    "",
    "Spending by category:",
    Object.entries(byCategory).length
      ? Object.entries(byCategory)
          .map(([c, a]) => `- ${c}: ₦${a.toLocaleString()}`)
          .join("\n")
      : "- (no expenses logged yet)",
    "",
    budgetLines.length
      ? `Budgets:\n${budgetLines.join("\n")}`
      : "Budgets: none set yet.",
  ].join("\n");
}

export async function chatBudget(req: AuthRequest, res: Response) {
  try {
    const { message, history } = req.body as {
      message?: string;
      history?: ChatMessage[];
    };

    if (!message || !message.trim()) {
      res.status(400).json({ message: "Message is required" });
      return;
    }
    if (!config.GEMINI_API_KEY) {
      res.status(500).json({ message: "AI is not configured (missing GEMINI_API_KEY)" });
      return;
    }

    const context = await buildFinancialContext(req.userId!);

    const systemPrompt = `You are CampusWallet's friendly budgeting assistant for university students in Nigeria.
You help the student understand their spending, stick to budgets, and save money.
Use the live financial snapshot below to give specific, personal answers — reference their real numbers, categories and budgets.
Keep replies short, warm and practical. Use ₦ for amounts. Tailor advice to Nigerian student life (transport, data, food, hostel). If they ask something unrelated to money/budgeting, gently steer back.

--- STUDENT'S CURRENT FINANCES ---
${context}
--- END ---`;

    // Map prior turns + the new message into Gemini's contents format.
    const contents = [
      ...(history ?? [])
        .filter((m) => m && (m.role === "user" || m.role === "model") && m.content)
        .slice(-12) // keep the last few turns for context
        .map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
      { role: "user", parts: [{ text: message }] },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

    const gRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
          // Disable gemini-2.5 "thinking" tokens so the full budget goes to the
          // visible reply (and to conserve free-tier quota).
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (gRes.status === 429) {
      res.status(429).json({
        message:
          "The AI assistant is busy (free-tier limit reached). Please wait a minute and try again.",
      });
      return;
    }
    if (!gRes.ok) {
      const detail = await gRes.text().catch(() => "");
      throw new Error(`Gemini API error ${gRes.status}: ${detail.slice(0, 200)}`);
    }

    const data = (await gRes.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const reply =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ??
      "Sorry, I couldn't come up with a response. Try rephrasing?";

    res.json({ reply });
  } catch (err) {
    console.error("[chatBudget]", err);
    res.status(500).json({ message: (err as Error).message });
  }
}
