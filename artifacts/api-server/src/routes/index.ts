import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import tenantRouter from "./tenant";
import productsRouter from "./products";
import categoriesRouter from "./categories";
import ordersRouter from "./orders";
import customersRouter from "./customers";
import employeesRouter from "./employees";
import inventoryRouter from "./inventory";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(tenantRouter);
router.use(productsRouter);
router.use(categoriesRouter);
router.use(ordersRouter);
router.use(customersRouter);
router.use(employeesRouter);
router.use(inventoryRouter);
router.use(reportsRouter);

export default router;
