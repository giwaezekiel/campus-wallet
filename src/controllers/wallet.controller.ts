import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware";
import { Wallet, WalletTransaction } from "../model/wallet.model";
import { User } from "../model/user.model";


export async function getBalance(req: AuthRequest, res: Response) {
  try {
    const wallet = await Wallet.findOne({ user: req.userId });
    res.json({ balance: wallet?.balance ?? 0 });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

// Resolve a recipient (by user id) so the scanner can confirm who they're paying
// before sending money. Returns minimal public info only.
export async function lookupRecipient(req: AuthRequest, res: Response) {
  try {
    const recipient = await User.findById(req.params.id).select("name school");
    if (!recipient) {
      res.status(404).json({ message: "Recipient not found" });
      return;
    }
    res.json({ id: recipient.id, name: recipient.name, school: recipient.school });
  } catch {
    res.status(400).json({ message: "Invalid recipient" });
  }
}

// Wallet-to-wallet transfer. The debit is conditional on sufficient balance so
// concurrent requests can't overdraw the sender's wallet.
export async function transferMoney(req: AuthRequest, res: Response) {
  try {
    const { recipientId, amount } = req.body as { recipientId?: string; amount?: number };
    const value = Number(amount);

    if (!recipientId) {
      res.status(400).json({ message: "Recipient is required" });
      return;
    }
    if (!value || value <= 0) {
      res.status(400).json({ message: "Enter a valid amount" });
      return;
    }
    if (recipientId === req.userId) {
      res.status(400).json({ message: "You can't send money to yourself" });
      return;
    }

    const recipient = await User.findById(recipientId).select("name");
    if (!recipient) {
      res.status(404).json({ message: "Recipient not found" });
      return;
    }

    const sender = await User.findById(req.userId).select("name");

    // Atomic debit: only succeeds if balance is high enough
    const debited = await Wallet.findOneAndUpdate(
      { user: req.userId, balance: { $gte: value } },
      { $inc: { balance: -value } },
      { new: true }
    );
    if (!debited) {
      res.status(400).json({ message: "Insufficient balance" });
      return;
    }

    // Credit recipient (create wallet if they don't have one yet)
    await Wallet.findOneAndUpdate(
      { user: recipientId },
      { $inc: { balance: value } },
      { new: true, upsert: true }
    );

    // Record both legs
    await WalletTransaction.create([
      {
        user: req.userId,
        type: "debit",
        amount: value,
        description: `Transfer to ${recipient.name}`,
      },
      {
        user: recipientId,
        type: "credit",
        amount: value,
        description: `Transfer from ${sender?.name ?? "a user"}`,
      },
    ]);

    res.json({ message: "Transfer successful", balance: debited.balance });
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
