import { Router, type IRouter, type Request, type Response } from "express";
import { db, userPortfoliosTable, userWatchlistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/user-data/portfolio", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [row] = await db
    .select()
    .from(userPortfoliosTable)
    .where(eq(userPortfoliosTable.userId, req.user.id));

  res.json({ portfolio: row?.data ?? null });
});

router.put("/user-data/portfolio", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { portfolio } = req.body;
  if (!portfolio) {
    res.status(400).json({ error: "Missing portfolio data" });
    return;
  }

  await db
    .insert(userPortfoliosTable)
    .values({ userId: req.user.id, data: portfolio })
    .onConflictDoUpdate({
      target: userPortfoliosTable.userId,
      set: { data: portfolio, updatedAt: new Date() },
    });

  res.json({ success: true });
});

router.get("/user-data/watchlist", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [row] = await db
    .select()
    .from(userWatchlistsTable)
    .where(eq(userWatchlistsTable.userId, req.user.id));

  res.json({ watchlist: row?.data ?? null });
});

router.put("/user-data/watchlist", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { watchlist } = req.body;
  if (!watchlist) {
    res.status(400).json({ error: "Missing watchlist data" });
    return;
  }

  await db
    .insert(userWatchlistsTable)
    .values({ userId: req.user.id, data: watchlist })
    .onConflictDoUpdate({
      target: userWatchlistsTable.userId,
      set: { data: watchlist, updatedAt: new Date() },
    });

  res.json({ success: true });
});

export default router;
