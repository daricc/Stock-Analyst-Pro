import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const userPortfoliosTable = pgTable("user_portfolios", {
  userId: text("user_id").primaryKey().references(() => usersTable.id),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userWatchlistsTable = pgTable("user_watchlists", {
  userId: text("user_id").primaryKey().references(() => usersTable.id),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
