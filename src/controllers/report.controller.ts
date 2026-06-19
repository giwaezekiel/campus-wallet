import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware";
import { Expense } from "../model/expense.model";

export async function getMonthlyReport(req: AuthRequest, res: Response) {
  try {
    const { month } = req.query as { month?: string };
    const start = month
      ? new Date(`${month}-01`)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const [summary] = await Expense.aggregate([
      { $match: { user: req.userId, date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          totalSpentThisMonth: { $sum: "$amount" },
          expenseCount: { $count: {} },
        },
      },
    ]);

    res.json(summary ?? { totalSpentThisMonth: 0, expenseCount: 0 });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getBreakdown(req: AuthRequest, res: Response) {
  try {
    const { month } = req.query as { month?: string };
    const start = month
      ? new Date(`${month}-01`)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const groups = await Expense.aggregate([
      { $match: { user: req.userId, date: { $gte: start, $lt: end } } },
      { $group: { _id: "$category", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
    ]);

    const total = groups.reduce((s, g) => s + g.amount, 0);
    const breakdown = groups.map(g => ({
      category: g._id,
      amount: g.amount,
      percentage: total > 0 ? Math.round((g.amount / total) * 100) : 0,
    }));

    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function exportCSV(req: AuthRequest, res: Response) {
  try {
    const { month } = req.query as { month?: string };
    const filter: Record<string, unknown> = { user: req.userId };

    if (month) {
      const start = new Date(`${month}-01`);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      filter.date = { $gte: start, $lt: end };
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });

    const rows = [
      ["Date", "Category", "Amount (₦)", "Note"],
      ...expenses.map(e => [
        (e.date as Date).toISOString().slice(0, 10),
        e.category,
        e.amount.toString(),
        e.note ?? "",
      ]),
    ];

    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="expenses-${month ?? "all"}.csv"`
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
