import { type Request, type Response } from "express";
import crypto from "crypto";
import { type AuthRequest } from "../middleware/auth.middleware";
import { paystack } from "../../shared/services/paystack";
import { Wallet, WalletTransaction } from "../model/wallet.model";
import { User } from "../model/user.model";
import { config } from "../../shared/config/config";

export async function initiatePayment(req: AuthRequest, res: Response) {
  try {
    const { amount } = req.body;
    if (!amount || amount < 100) {
      res.status(400).json({ message: "Minimum top-up amount is ₦100" });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const callbackUrl = `${config.CLIENT_URL}/wallet/verify`;
    const data = await paystack.initializeTransaction(
      user.email,
      amount,
      callbackUrl,
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}

// export async function verifyPayment(req: AuthRequest, res: Response) {
//   try {
//     const ref = req.params["ref"] as string;
//     const data = await paystack.verifyTransaction(ref);
//     console.log(data.status);

//     if (data.status === "success") {
//       const amountNaira = data.amount / 100;

//       // Credit wallet (idempotent — check reference not already processed)
//       const existing = await WalletTransaction.findOne({
//         reference: data.reference,
//       });

//       if (!existing) {
//         const user = await User.findOne({
//           email: data.customer.email,
//         });

//         if (!user) {
//           throw new Error("User not found");
//         }

//         const wallet = await Wallet.findOneAndUpdate(
//           { user: req.userId },
//           { $inc: { balance: amountNaira } },
//           { new: true, upsert: true },
//         );
//         console.log("updated wallet:", wallet);
//         console.log("req.userId:", req.userId);
//         console.log("reference:", ref);
//         console.log("paystack data:", data);
//         await WalletTransaction.create({
//           user: req.userId,
//           type: "credit",
//           amount: amountNaira,
//           description: "Wallet top-up via Paystack",
//           reference: data.reference,
//         });
//       }
//     }

//     res.json({
//       status: data.status,
//       amount: data.amount,
//       reference: data.reference,
//     });
//   } catch (err) {
//     res.status(500).json({ message: (err as Error).message });
//   }
// }

export async function verifyPayment(req: AuthRequest, res: Response) {
  try {
    const ref = req.params.ref as string;

    const data = await paystack.verifyTransaction(ref);

    // Find user from Paystack customer email
    const user = await User.findOne({ email: data.customer.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure the user always has a wallet to report a balance from
    let wallet = await Wallet.findOne({ user: user._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: user._id, balance: 0 });
    }

    // Only a successful charge credits the wallet
    if (data.status === "success") {
      // Idempotent: only credit once per Paystack reference
      const existing = await WalletTransaction.findOne({
        reference: data.reference,
      });

      if (!existing) {
        const amountNaira = data.amount / 100;

        wallet.balance += amountNaira;
        await wallet.save();

        await WalletTransaction.create({
          user: user._id,
          type: "credit",
          amount: amountNaira,
          description: "Wallet top-up via Paystack",
          reference: data.reference,
        });
      }
    }

    // Shape matches the frontend verify page: { status, amount, reference }
    return res.status(200).json({
      status: data.status,
      amount: data.amount,
      reference: data.reference,
      balance: wallet.balance,
    });
  } catch (err) {
    console.error("[verifyPayment]", err);
    return res.status(500).json({ message: (err as Error).message });
  }
}

export async function paystackWebhook(req: Request, res: Response) {
  const secret = config.PAYSTACK_SECRET_KEY;
  const signature = String(req.headers["x-paystack-signature"] ?? "");

  // req.body is the raw Buffer (see app.ts). Sign the exact bytes Paystack sent.
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body));
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

  if (hash !== signature) {
    res.status(401).json({ message: "Invalid signature" });
    return;
  }

  const { event, data } = JSON.parse(rawBody.toString());
  if (event === "charge.success") {
    try {
      const existing = await WalletTransaction.findOne({
        reference: data.reference,
      });
      if (existing) {
        res.sendStatus(200);
        return;
      }

      const user = await User.findOne({ email: data.customer.email });
      if (!user) {
        res.sendStatus(200);
        return;
      }

      const amountNaira = data.amount / 100;
      await Wallet.findOneAndUpdate(
        { user: user._id },
        { $inc: { balance: amountNaira } },
        { upsert: true },
      );
      await WalletTransaction.create({
        user: user._id,
        type: "credit",
        amount: amountNaira,
        description: "Wallet top-up via Paystack",
        reference: data.reference,
      });
    } catch {
      // Log but still respond 200 — Paystack will not retry on non-200
    }
  }

  res.sendStatus(200);
}

export async function getPaymentHistory(req: AuthRequest, res: Response) {
  try {
    const history = await WalletTransaction.find({
      user: req.userId,
      type: "credit",
    })
      .sort({ date: -1 })
      .limit(20);
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
}
