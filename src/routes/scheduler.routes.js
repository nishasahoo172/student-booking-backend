import { Router } from "express";
import { getBusy } from "../controllers/scheduler.controller.js";

const router = Router();
router.get("/busy", getBusy);

export default router;
