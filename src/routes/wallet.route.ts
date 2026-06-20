import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getBalance,
  getTransactions,
  lookupRecipient,
  transferMoney,
} from "../controllers/wallet.controller";

const router = Router();
router.use(authenticate);

router.get("/balance", getBalance);
router.get("/transactions", getTransactions);
router.get("/lookup/:id", lookupRecipient);
router.post("/transfer", transferMoney);

export default router;
