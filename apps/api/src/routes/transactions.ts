import { Hono } from "hono";
import { requireAuth, requireAdminSubRole, requireBrandSubRole } from "../middleware/auth";
import { db } from "../db/client";
import * as transactionsRepo from "../repositories/transactions.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";
import * as transactionService from "../services/transaction.service";
import * as redemptionCodesRepo from "../repositories/redemptionCodes.repo";

export const transactionRoutes = new Hono();

transactionRoutes.use("/*", requireAuth);

transactionRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const roles = await userRolesRepo.getRolesForUser(db, userId);
  const isAdmin = roles.some((r) => ["super_admin", "admin", "affiliation_admin", "commerce_admin"].includes(r.role));
  const isBrand = roles.some((r) => ["brand_partner", "brand_manager"].includes(r.role));

  if (isAdmin && c.req.query("userId")) {
    return c.json(await transactionsRepo.listTransactions(db, { userId: c.req.query("userId")! }));
  }
  if (isBrand && c.req.query("brandId")) {
    return c.json(await transactionsRepo.listTransactions(db, { brandId: c.req.query("brandId")! }));
  }
  return c.json(await transactionsRepo.listTransactions(db, { userId }));
});

transactionRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const transaction = await transactionService.createTransaction(db, { ...body, userId });
  return c.json(transaction, 201);
});

transactionRoutes.get("/:id", async (c) => {
  const transaction = await transactionsRepo.getTransaction(db, c.req.param("id"));
  if (!transaction) return c.json({ error: "Transaction not found" }, 404);
  return c.json(transaction);
});

transactionRoutes.post("/redeem", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json();
  const { code, dealId } = body;

  if (!code || !dealId) {
    return c.json({ error: "code and dealId are required" }, 400);
  }

  try {
    const transaction = await transactionService.redeemDealWithCode(db, userId, code, dealId);
    return c.json(transaction, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Redemption failed" }, 400);
  }
});

transactionRoutes.get("/redemption-codes/:code", async (c) => {
  const codeData = await redemptionCodesRepo.getRedemptionCode(db, c.req.param("code"));
  if (!codeData) return c.json({ error: "Redemption code not found" }, 404);
  return c.json(codeData);
});
