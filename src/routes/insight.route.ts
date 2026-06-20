import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { chatBudget } from "../controllers/chat.controller";
import { planBudget, applyPlan } from "../controllers/planner.controller";

const insightRouter = Router();

insightRouter.post("/chat", chatBudget);
insightRouter.post("/plan", planBudget);
insightRouter.post("/plan/apply", applyPlan);

export default insightRouter;
