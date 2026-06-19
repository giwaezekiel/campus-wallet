import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getBalance, getTransactions } from "../controllers/wallet.controller";

const router = Router();
router.use(authenticate);

router.get("/balance", getBalance);
router.get("/transactions", getTransactions);

export default router;
