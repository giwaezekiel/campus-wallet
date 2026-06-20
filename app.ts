import express, { type Request, type Response } from "express";
import cors from "cors";
import { config } from "./shared/config/config";

import authRoutes from "./src/routes/auth.route";
import budgetRoutes from "./src/routes/budget.route";
import expenseRoutes from "./src/routes/expense.route";
import walletRoutes from "./src/routes/wallet.route";
import paymentRoutes from "./src/routes/payment.route";
import reportRoutes from "./src/routes/report.route";

export const app = express();

const allowedOrigins = [
  config.CLIENT_URL,
  "http://localhost:3000",
  "https://campuswallet-one.vercel.app",
].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Raw body for Paystack webhook signature verification
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString());
    next();
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "CampusWallet API is live" });
});

app.use("/api/auth", authRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});
