import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stocksRouter from "./stocks";
import authRouter from "./auth";
import userDataRouter from "./user-data";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userDataRouter);
router.use(stripeRouter);
router.use(stocksRouter);

export default router;
