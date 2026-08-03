import { Router } from "express";
import {
  getBusy,
  checkCourseAccess,
} from "../controllers/scheduler.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { requireCourseAccess } from "../middleware/courseAccess.middleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Verify Course Access
|--------------------------------------------------------------------------
*/

router.get(
  "/access",
  requireAuth,
  requireCourseAccess,
  checkCourseAccess
);

/*
|--------------------------------------------------------------------------
| Load Busy Calendar
|--------------------------------------------------------------------------
*/

router.get(
  "/busy",
  requireAuth,
  requireCourseAccess,
  getBusy
);

export default router;