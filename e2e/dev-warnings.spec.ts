import { classicPuzzle, dailyPuzzle } from "../shared/engine";
import { bustRoute, clickAll, expect, skipHelp, test, today, winningMoves } from "./support";

// Runs against `vite` (development mode), where React reports duplicate keys,
// invalid DOM nesting and Strict Mode problems. The shared `test` fixture fails
// on any console warning or error, so a clean pass means none were logged.

test("plays both modes without React warnings", async ({ page }) => {
  await skipHelp(page);
  await page.goto("/");
  await expect(page.getByTestId("target")).toBeVisible();

  await clickAll(page, bustRoute(dailyPuzzle(today()), "reset"));
  await clickAll(page, winningMoves(dailyPuzzle(today())));
  const result = page.getByRole("dialog", { name: /solved/ });
  await expect(result).toBeVisible();
  await expect(result.getByText(/ranked #\d+ of \d+/)).toBeVisible();
  await result.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "classic" }).click();
  await clickAll(page, bustRoute(classicPuzzle("dev-board"), "end").slice(0, 1));
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("dialog", { name: "How to play" })).toBeVisible();
});
