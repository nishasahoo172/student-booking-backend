import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import { createBooking, listBookings, myCredits } from "../controllers/booking.controller.js";

const router = Router();

router.get("/", requireAuth, listBookings);
router.post("/", requireAuth, createBooking);
router.get("/me/credits", requireAuth, myCredits);

export default router;


