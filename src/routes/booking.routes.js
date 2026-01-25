import { Router } from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import { createBooking } from "../controllers/booking.controller.js";

const router = Router();

router.post("/", authMiddleware, createBooking);

export default router;
