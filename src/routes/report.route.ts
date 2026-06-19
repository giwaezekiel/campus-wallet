import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getMonthlyReport, getBreakdown, exportCSV } from "../controllers/report.controller";

const router = Router();
router.use(authenticate);

router.get("/monthly", getMonthlyReport);
router.get("/breakdown", getBreakdown);
router.get("/export", exportCSV);

export default router;
