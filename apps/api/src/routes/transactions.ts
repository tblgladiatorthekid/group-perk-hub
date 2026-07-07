import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as transactionsRepo from "../repositories/transactions.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";
import { createTransaction } from "../services/transaction.service";

export const transactionRoutes = new Hono();

transactionRoutes.use("/*", requireAuth);

transactionRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  const isBrand = await userRolesRepo.hasRole(db, userId, "brand_partner");

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
  const transaction = await createTransaction(db, { ...body, userId });
  return c.json(transaction, 201);
});

transactionRoutes.get("/:id", async (c) => {
  const transaction = await transactionsRepo.getTransaction(db, c.req.param("id"));
  if (!transaction) return c.json({ error: "Transaction not found" }, 404);
  return c.json(transaction);
});
