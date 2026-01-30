import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listCourses } from "../controllers/course.controller.js";

const router = Router();
router.get("/", requireAuth, listCourses);
export default router;
