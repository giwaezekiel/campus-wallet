import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getAIInsights } from "../controllers/aiInsight.controller";
import { chatBudget } from "../controllers/chat.controller";

const router = Router();
router.use(authenticate);

router.get("/insights", getAIInsights);
router.post("/chat", chatBudget);

export default router;
