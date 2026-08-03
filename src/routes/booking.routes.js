import express from "express";
import {
  createBooking,
  listMyBookings,
  upcomingBooking,
  myCredits,
  purchaseHistory,
  creditHistory,
  buyCredits,
  getAvailableSlots,
  rescheduleBooking
} from "../controllers/booking.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/credits", requireAuth, myCredits);
router.get("/bookings", requireAuth, listMyBookings);
router.get("/upcoming", requireAuth, upcomingBooking);

router.post("/", requireAuth, createBooking);

router.get("/me/purchase-history", requireAuth, purchaseHistory);
router.get("/credit-history", requireAuth, creditHistory);

router.post("/buy-credits", requireAuth, buyCredits);

// Available slots API
router.get("/available-slots", requireAuth, getAvailableSlots);

// Reschedule booking API
router.patch("/:id/reschedule", requireAuth, rescheduleBooking);

export default router;