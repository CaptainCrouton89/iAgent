import { Router } from "express";
import jobRoutes from "./jobRoutes";

const router = Router();

// Mount all routes
router.use("/jobs", jobRoutes);

export default router;
