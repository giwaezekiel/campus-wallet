import { Expense } from "../model/expense.model";
import { type AuthRequest } from "../middleware/auth.middleware";
import { type Response } from "express";
import { Budget } from "../model/budget.model";
export async function getAIInsights(req: AuthRequest, res: Response) {
  try {
    const { month } = req.query as { month?: string };

    // Default to current month
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);
    const start = new Date(`${targetMonth}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    // Fetch this month's expenses for the user
    const expenses = await Expense.find({
      user: req.userId,
      date: { $gte: start, $lt: end },
    }).sort({ date: -1 });

    if (expenses.length === 0) {
      res.json({
        insights: null,
        message:
          "No expenses found for this month. Start logging to get insights!",
      });
      return;
    }

    // Build summary data to send to Claude
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {});

    // Fetch budgets for context
    const budgets = await Budget.find({ user: req.userId, month: targetMonth });
    const budgetContext = budgets.map((b) => ({
      category: b.category,
      limit: b.limit,
      spent: b.spent,
      percentageUsed: Math.round((b.spent / b.limit) * 100),
    }));

    const prompt = `You are a smart financial advisor for university students in Nigeria. Analyze this student's spending and give sharp, actionable insights.
 
Month: ${targetMonth}
Total spent: ₦${total.toLocaleString()}
 
Spending by category:
${Object.entries(byCategory)
  .map(([cat, amt]) => `- ${cat}: ₦${amt.toLocaleString()}`)
  .join("\n")}
 
${budgetContext.length > 0 ? `Budget status:\n${budgetContext.map((b) => `- ${b.category}: ₦${b.spent.toLocaleString()} of ₦${b.limit.toLocaleString()} (${b.percentageUsed}%)`).join("\n")}` : "No budgets set yet."}
 
Recent expenses (last 10):
${expenses
  .slice(0, 10)
  .map(
    (e) =>
      `- ${e.category}: ₦${e.amount.toLocaleString()}${e.note ? ` (${e.note})` : ""} on ${(e.date as Date).toLocaleDateString("en-NG")}`,
  )
  .join("\n")}
 
Respond ONLY with a valid JSON object, no markdown, no explanation:
{
 "summary": "One punchy sentence about their overall spending this month",
 "topInsight": "The single most important observation about their spending pattern",
 "warnings": ["warning if overspending in a category or vs budget", "another if applicable — omit array item if none"],
 "tips": ["specific actionable tip 1", "specific actionable tip 2", "specific actionable tip 3"],
 "savingsGoal": "A realistic weekly savings target based on their spending habits",
 "biggestSpend": "The category they spent the most on and a one-line comment about it",
 "spendingScore": 72
}
 
spendingScore is 0–100: 100 = perfect student budgeting. Be honest but encouraging. Tailor advice to Nigerian student life (NANS, hostel, transport, data).`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text?: string }[];
    };
    const text = data.content
      .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
      .join("");

    const clean = text.replace(/```json|```/g, "").trim();
    const insights = JSON.parse(clean);

    res.json({
      month: targetMonth,
      total,
      byCategory,
      expenseCount: expenses.length,
      budgetContext,
      insights,
    });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
