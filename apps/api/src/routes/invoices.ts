import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import * as invoicesRepo from "../repositories/invoices.repo";
import * as userRolesRepo from "../repositories/userRoles.repo";

export const invoiceRoutes = new Hono();

invoiceRoutes.use("/*", requireAuth);

invoiceRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");

  if (isAdmin) {
    return c.json(await invoicesRepo.listInvoices(db));
  }
  if (c.req.query("brandId")) {
    return c.json(await invoicesRepo.listInvoices(db, c.req.query("brandId")!));
  }
  return c.json([]);
});

invoiceRoutes.get("/:id", async (c) => {
  const invoice = await invoicesRepo.getInvoice(db, c.req.param("id"));
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  return c.json(invoice);
});

invoiceRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const invoice = await invoicesRepo.createInvoice(db, body);
  return c.json(invoice, 201);
});

invoiceRoutes.patch("/:id", async (c) => {
  const userId = c.var.userId;
  const isAdmin = await userRolesRepo.hasRole(db, userId, "admin");
  if (!isAdmin) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const invoice = await invoicesRepo.updateInvoice(db, c.req.param("id"), body);
  return c.json(invoice);
});
