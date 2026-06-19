import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware";
import { Budget } from "../model/budget.model";

export async function createBudget(req: AuthRequest, res: Response) {
  try {
    const { category, limit, month } = req.body;
    const budget = await Budget.create({ user: req.userId, category, limit, month });
    res.status(201).json(budget);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Budget for this category and month already exists" });
      return;
    }
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getBudgets(req: AuthRequest, res: Response) {
  try {
    const budgets = await Budget.find({ user: req.userId }).sort({ month: -1, category: 1 });
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getBudget(req: AuthRequest, res: Response) {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, user: req.userId });
    if (!budget) { res.status(404).json({ message: "Budget not found" }); return; }
    res.json(budget);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function updateBudget(req: AuthRequest, res: Response) {
  try {
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { limit: req.body.limit },
      { new: true, runValidators: true }
    );
    if (!budget) { res.status(404).json({ message: "Budget not found" }); return; }
    res.json(budget);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function deleteBudget(req: AuthRequest, res: Response) {
  try {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!budget) { res.status(404).json({ message: "Budget not found" }); return; }
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getBudgetAlerts(req: AuthRequest, res: Response) {
  try {
    const budgets = await Budget.find({ user: req.userId });
    const alerts = budgets.filter(b => b.limit > 0 && b.spent / b.limit >= 0.8);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
