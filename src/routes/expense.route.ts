import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  getExpenseTrends,
  getAIInsights,
} from "../controllers/expense.controller";

const router = Router();
router.use(authenticate);

router.get("/summary", getExpenseSummary);
router.get("/trends", getExpenseTrends);
router.route("/").get(getExpenses).post(createExpense);
router.get("/insights", getAIInsights);
router.route("/:id").get(getExpense).put(updateExpense).delete(deleteExpense);

export default router;
