import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware";
import { Expense } from "../model/expense.model";
import { Budget } from "../model/budget.model";
import { User } from "../model/user.model";
import { sendBudgetAlert } from "../../shared/email/notification";

async function checkAndAlertBudget(userId: string, category: string) {
  const month = new Date().toISOString().slice(0, 7);
  const budget = await Budget.findOne({ user: userId, category, month });
  if (!budget || budget.alertSent) return;

  const pct = Math.round((budget.spent / budget.limit) * 100);
  if (pct < 80) return;

  const user = await User.findById(userId);
  if (!user) return;

  sendBudgetAlert({
    email: user.email,
    name: user.name,
    category,
    spent: budget.spent,
    limit: budget.limit,
    percentage: pct,
  }).catch(() => {});

  budget.alertSent = true;
  await budget.save();
}

export async function createExpense(req: AuthRequest, res: Response) {
  try {
    const { amount, category, note, date } = req.body;
    const expense = await Expense.create({
      user: req.userId,
      amount,
      category,
      note,
      date: date ? new Date(date) : new Date(),
    });

    // Update budget spent for the expense's month
    const month = (expense.date as Date).toISOString().slice(0, 7);
    const budget = await Budget.findOne({ user: req.userId, category, month });
    if (budget) {
      budget.spent += amount;
      await budget.save();
      checkAndAlertBudget(req.userId!, category).catch(() => {});
    }

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getExpenses(req: AuthRequest, res: Response) {
  try {
    const { category, month, limit = "50" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { user: req.userId };

    if (category) filter.category = category;
    if (month) {
      const start = new Date(`${month}-01`);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      filter.date = { $gte: start, $lt: end };
    }

    const expenses = await Expense.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit));
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getExpense(req: AuthRequest, res: Response) {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.userId });
    if (!expense) { res.status(404).json({ message: "Expense not found" }); return; }
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function updateExpense(req: AuthRequest, res: Response) {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!expense) { res.status(404).json({ message: "Expense not found" }); return; }
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function deleteExpense(req: AuthRequest, res: Response) {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!expense) { res.status(404).json({ message: "Expense not found" }); return; }

    // Reverse the budget spent amount
    const month = (expense.date as Date).toISOString().slice(0, 7);
    await Budget.findOneAndUpdate(
      { user: req.userId, category: expense.category, month },
      { $inc: { spent: -expense.amount } }
    );

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getExpenseSummary(req: AuthRequest, res: Response) {
  try {
    const { month } = req.query as { month?: string };
    const start = month ? new Date(`${month}-01`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
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

export async function getExpenseTrends(req: AuthRequest, res: Response) {
  try {
    const trends = await Expense.aggregate([
      { $match: { user: req.userId } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 6 },
      { $project: { _id: 0, month: "$_id", total: 1 } },
    ]);
    res.json(trends);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
