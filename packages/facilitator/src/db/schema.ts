/**
 * Mirrored from packages/web/drizzle/schema.ts — keep in sync.
 * Only includes tables the facilitator needs for API key validation
 * and transaction logging.
 */
import { pgTable, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  stellarAddress: text("stellar_address"),
})

export const endpointMethodEnum = pgEnum("endpoint_method", ["GET", "POST", "PUT", "PATCH", "DELETE"])
export const endpointStatusEnum = pgEnum("endpoint_status", ["active", "paused"])

export const endpoints = pgTable("endpoints", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  method: endpointMethodEnum("method").notNull(),
  path: text("path").notNull(),
  price: numeric("price", { precision: 18, scale: 7 }).notNull(),
  status: endpointStatusEnum("status").notNull().default("active"),
})

export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "settled", "failed"])

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpointId: text("endpoint_id").references(() => endpoints.id, {
    onDelete: "set null",
  }),
  amount: numeric("amount", { precision: 18, scale: 7 }).notNull(),
  payerAddress: text("payer_address").notNull(),
  txHash: text("tx_hash"),
  status: transactionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  hash: text("hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
})
