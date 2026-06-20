import { Router } from "express";
import { getAIInsights } from "../controllers/aiInsight.controller";

const router = Router();

router.get("/insights", getAIInsights);

export default router;
