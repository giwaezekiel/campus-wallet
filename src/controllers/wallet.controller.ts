import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware";
import { Wallet, WalletTransaction } from "../model/wallet.model";

export async function getBalance(req: AuthRequest, res: Response) {
  try {
    const wallet = await Wallet.findOne({ user: req.userId });
    res.json({ balance: wallet?.balance ?? 0 });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

export async function getTransactions(req: AuthRequest, res: Response) {
  try {
    const transactions = await WalletTransaction.find({ user: req.userId })
      .sort({ date: -1 })
      .limit(50);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
