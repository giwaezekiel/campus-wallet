import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware";
import { Budget } from "../model/budget.model";
import { config } from "../../shared/config/config";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// Categories the app supports — the AI must allocate within these.
const CATEGORIES = [
  "Food",
  "Transport",
  "Books & Stationery",
  "Accommodation",
  "Data & Airtime",
  "Health",
  "Entertainment",
  "Clothing",
  "Others",
];

type Allocation = { category: string; amount: number; note?: string };

// Ask Gemini for a budget allocation and return validated, clamped allocations.
export async function planBudget(req: AuthRequest, res: Response) {
  try {
    const { amount, period, context } = req.body as {
      amount?: number;
      period?: "week" | "month";
      context?: string;
    };

    const total = Number(amount);
    const span = period === "week" ? "week" : "month";

    if (!total || total <= 0) {
      res.status(400).json({ message: "Enter a valid budget amount" });
      return;
    }
    if (!config.GEMINI_API_KEY) {
      res.status(500).json({ message: "AI is not configured (missing GEMINI_API_KEY)" });
      return;
    }

    const prompt = `You are a budgeting assistant for a Nigerian university student.
The student has a total budget of ₦${total.toLocaleString()} for one ${span}.
Suggest a realistic allocation across these categories (use only these exact names):
${CATEGORIES.join(", ")}.
${context ? `Extra context from the student: ${context}` : ""}

Rules:
- The allocation amounts MUST sum to exactly ₦${total}.
- Only include categories that make sense; you may omit some.
- Prioritise essentials (Food, Transport, Data & Airtime) for student life.
- Keep each "note" to a short phrase.

Respond with ONLY this JSON shape, nothing else:
{
  "period": "${span}",
  "total": ${total},
  "allocations": [
    { "category": "Food", "amount": 0, "note": "short reason" }
  ],
  "advice": "One short sentence of practical advice."
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;
    const gRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 800,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (gRes.status === 429) {
      res.status(429).json({
        message: "The AI is busy (free-tier limit). Wait a minute and try again.",
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
    const raw =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // Validate + clamp to known categories and numeric amounts
    const allocations: Allocation[] = (parsed.allocations ?? [])
      .filter((a: Allocation) => CATEGORIES.includes(a.category) && Number(a.amount) > 0)
      .map((a: Allocation) => ({
        category: a.category,
        amount: Math.round(Number(a.amount)),
        note: typeof a.note === "string" ? a.note : "",
      }));

    res.json({
      period: span,
      total,
      allocations,
      allocated: allocations.reduce((s, a) => s + a.amount, 0),
      advice: typeof parsed.advice === "string" ? parsed.advice : "",
    });
  } catch (err) {
    console.error("[planBudget]", err);
    res.status(500).json({ message: (err as Error).message });
  }
}

// Turn an accepted plan into real budgets for the current month (idempotent
// upsert per category). Weekly plans are scaled x4 to a monthly limit.
export async function applyPlan(req: AuthRequest, res: Response) {
  try {
    const { allocations, period } = req.body as {
      allocations?: Allocation[];
      period?: "week" | "month";
    };

    if (!Array.isArray(allocations) || allocations.length === 0) {
      res.status(400).json({ message: "No allocations to apply" });
      return;
    }

    const month = new Date().toISOString().slice(0, 7);
    const factor = period === "week" ? 4 : 1; // approx weeks per month

    const valid = allocations.filter(
      (a) => CATEGORIES.includes(a.category) && Number(a.amount) > 0
    );

    await Promise.all(
      valid.map((a) =>
        Budget.updateOne(
          { user: req.userId, category: a.category, month },
          { $set: { limit: Math.round(Number(a.amount) * factor) } },
          { upsert: true }
        )
      )
    );

    res.json({ message: "Budgets created", count: valid.length, month });
  } catch (err) {
    console.error("[applyPlan]", err);
    res.status(500).json({ message: (err as Error).message });
  }
}
