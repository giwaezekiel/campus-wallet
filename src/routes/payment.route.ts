import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  initiatePayment,
  verifyPayment,
  paystackWebhook,
  getPaymentHistory,
} from "../controllers/payment.controller";

const router = Router();

// Webhook must use raw body — mounted before JSON middleware in app.ts
router.post("/webhook", paystackWebhook);

router.use(authenticate);
router.post("/initiate", initiatePayment);
router.get("/verify/:ref", verifyPayment);
router.get("/history", getPaymentHistory);

export default router;
