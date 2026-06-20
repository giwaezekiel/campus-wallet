import { Router } from "express";
import { getAIInsights } from "../controllers/aiInsight.controller";

const insightRouter = Router();

router.get("/insights", getAIInsights);

export default router;
