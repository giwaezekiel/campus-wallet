import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createBudget,
  getBudgets,
  getBudget,
  updateBudget,
  deleteBudget,
  getBudgetAlerts,
} from "../controllers/budget.controller";

const router = Router();
router.use(authenticate);

router.get("/alerts", getBudgetAlerts);
router.route("/").get(getBudgets).post(createBudget);
router.route("/:id").get(getBudget).put(updateBudget).delete(deleteBudget);

export default router;
