import { classicPuzzle, dailyPuzzle, dayNumber } from "../shared/engine";
import {
  boardReady,
  bustRoute,
  clickAll,
  crystal,
  expect,
  settle,
  skipHelp,
  test,
  today,
  winningMoves,
} from "./support";

test.describe("first visit", () => {
  test("explains the rules once", async ({ page }) => {
    await page.goto("/");
    const help = page.getByRole("dialog", { name: "How to play" });
    await expect(help).toBeVisible();
    await help.getByRole("button", { name: "Got it" }).click();
    await expect(help).toBeHidden();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(help).toBeHidden();
  });

  test("help reopens from the button and the ? key, and closes with Escape", async ({ page }) => {
    await skipHelp(page);
    await page.goto("/");
    await boardReady(page);
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(page.getByRole("dialog", { name: "How to play" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "How to play" })).toBeHidden();

    // A native <dialog> drops its `open` state at once but fires `close` a task later, so a
    // keypress sent this instantly can arrive before React has processed the close. Pressing
    // `?` only ever opens the help, so retrying it is safe.
    await expect(async () => {
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog", { name: "How to play" })).toBeVisible({
        timeout: 1000,
      });
    }).toPass();
  });
});

test.describe("daily puzzle", () => {
  test.beforeEach(async ({ page }) => {
    await skipHelp(page);
  });

  test("starts on today's board with every crystal value hidden", async ({ page }) => {
    await page.goto("/");
    const puzzle = dailyPuzzle(today());
    await expect(page.getByText(`Daily puzzle #${dayNumber(today())}`)).toBeVisible();
    await expect(page.getByTestId("target")).toHaveText(String(puzzle.target));
    await expect(page.getByTestId("score")).toHaveText("0");
    for (const name of ["Blue", "Green", "Red", "Orange"]) {
      await expect(
        page.getByRole("button", { name: `${name} crystal, value hidden` }),
      ).toBeEnabled();
    }
  });

  test("reveals a crystal's value when it is clicked", async ({ page }) => {
    await page.goto("/");
    const puzzle = dailyPuzzle(today());
    await crystal(page, 0).click();
    await expect(crystal(page, 0)).toHaveAccessibleName(`Blue crystal, adds ${puzzle.values[0]}`);
    await expect(page.getByTestId("score")).toHaveText(String(puzzle.values[0]));
    await expect(crystal(page, 1)).toHaveAccessibleName("Green crystal, value hidden");
  });

  test("never leaves a stray gem behind after repeated clicks", async ({ page }) => {
    // Regression: two siblings shared a React key, which duplicated a crystal's artwork.
    await page.goto("/");
    await clickAll(page, [0, 2, 0]);
    for (const index of [0, 1, 2, 3] as const) {
      await expect(crystal(page, index).locator("svg")).toHaveCount(1);
    }
  });

  test("plays with the keyboard", async ({ page }) => {
    await page.goto("/");
    await boardReady(page);
    const puzzle = dailyPuzzle(today());
    await page.keyboard.press("2");
    await expect(page.getByTestId("score")).toHaveText(String(puzzle.values[1]));
    await crystal(page, 3).focus();
    await page.keyboard.press("Enter");
    await expect(crystal(page, 3)).toHaveAccessibleName(`Orange crystal, adds ${puzzle.values[3]}`);
  });

  test("solving it shows the result and a leaderboard rank", async ({ page }) => {
    await page.goto("/");
    const puzzle = dailyPuzzle(today());
    await clickAll(page, winningMoves(puzzle));

    const dialog = page.getByRole("dialog", { name: /Puzzle #\d+ solved/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Crystal clear")).toBeVisible();
    await expect(dialog.getByText(/ranked #\d+ of \d+/)).toBeVisible();
    await expect(dialog.getByRole("table", { name: "Players by number of clicks" })).toBeVisible();
    await expect(dialog.getByText(/Next puzzle in/)).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("total-streak")).toHaveText("1");
    for (const index of [0, 1, 2, 3] as const) await expect(crystal(page, index)).toBeDisabled();
  });

  test("a bust resets the score but keeps the board, and busts show in the result", async ({
    page,
  }) => {
    await page.goto("/");
    const puzzle = dailyPuzzle(today());
    await clickAll(page, bustRoute(puzzle, "reset"));
    await expect(page.getByTestId("busts")).toContainText("1 bust");
    await expect(page.getByTestId("score")).toHaveText("0");

    await clickAll(page, winningMoves(puzzle));
    const dialog = page.getByRole("dialog", { name: /Puzzle #\d+ solved/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("dl")).toContainText("Busts");
    await expect(
      dialog.getByRole("group", { name: "Busts" }).or(dialog.locator("dl")),
    ).toContainText("1");
    await expect(dialog.locator("pre")).toContainText("💥");
  });

  test("remembers progress, and the finished puzzle, after a reload", async ({ page }) => {
    await page.goto("/");
    const puzzle = dailyPuzzle(today());
    const moves = winningMoves(puzzle);

    await clickAll(page, moves.slice(0, 2));
    const score = (puzzle.values[moves[0] ?? 0] ?? 0) + (puzzle.values[moves[1] ?? 0] ?? 0);
    await page.reload();
    await expect(page.getByTestId("score")).toHaveText(String(score));

    await clickAll(page, moves.slice(2));
    await expect(page.getByRole("dialog", { name: /solved/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "View your result" })).toBeVisible();
    await expect(page.getByTestId("score")).toHaveText(String(puzzle.target));
    await expect(page.getByTestId("total-solved")).toHaveText("1");
    await page.getByRole("button", { name: "View your result" }).click();
    await expect(page.getByRole("dialog", { name: /solved/ })).toBeVisible();
  });

  test("moves on to the new puzzle when a tab is left open past midnight UTC", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-25T23:59:00Z") });
    await page.goto("/");
    await expect(page.getByTestId("target")).toHaveText(String(dailyPuzzle("2026-10-25").target));

    await page.clock.setSystemTime(new Date("2026-10-26T00:00:30Z"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

    await expect(page.getByText("Daily puzzle #2")).toBeVisible();
    await expect(page.getByTestId("target")).toHaveText(String(dailyPuzzle("2026-10-26").target));
  });

  test("leaves a Classic round alone when the day changes underneath it", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-25T23:59:00Z") });
    await page.goto("/?mode=classic&board=midnight");
    await crystal(page, 0).click();
    const score = await page.getByTestId("score").textContent();

    await page.clock.setSystemTime(new Date("2026-10-26T00:00:30Z"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByTestId("score")).toHaveText(score ?? "");

    // Going back to Daily is what refreshes the puzzle.
    await page.getByRole("button", { name: "daily" }).click();
    await expect(page.getByText("Daily puzzle #2")).toBeVisible();
  });

  test("copies a shareable result", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await page.goto("/");
    await clickAll(page, winningMoves(dailyPuzzle(today())));

    const dialog = page.getByRole("dialog", { name: /solved/ });
    await dialog.getByRole("button", { name: "Share result" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Copied!");

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(`💎 Crystal Collector #${dayNumber(today())}`);
    expect(copied).toMatch(/Crystal clear · \d+ clicks? \(min \d+\)/);
    expect(copied).toMatch(/[🟦🟩🟥🟧]/u);
  });
});

test.describe("leaderboard offline", () => {
  // The browser logs the requests this test aborts on purpose.
  test.use({ allowedProblem: /Failed to load resource|ERR_FAILED/ });

  test.beforeEach(async ({ page }) => {
    await skipHelp(page);
  });

  test("explains an unreachable leaderboard and retries", async ({ page }) => {
    await page.route("**/api/daily/**", (route) => route.abort());
    await page.goto("/");
    await clickAll(page, winningMoves(dailyPuzzle(today())));

    const dialog = page.getByRole("dialog", { name: /solved/ });
    await expect(dialog.getByText("The leaderboard is unreachable right now.")).toBeVisible();

    await page.unroute("**/api/daily/**");
    await dialog.getByRole("button", { name: "Try again" }).click();
    await expect(dialog.getByText(/ranked #\d+ of \d+/)).toBeVisible();
  });
});

test.describe("classic mode", () => {
  test.beforeEach(async ({ page }) => {
    await skipHelp(page);
  });

  test("a board link deals the same board every time", async ({ page }) => {
    await page.goto("/?mode=classic&board=shared-board");
    await expect(page.getByText("Classic · board shared-board")).toBeVisible();
    await expect(page.getByTestId("target")).toHaveText(
      String(classicPuzzle("shared-board").target),
    );
  });

  test("wins a round, keeps the tally and deals a new board", async ({ page }) => {
    await page.goto("/?mode=classic&board=e2e-win");
    await clickAll(page, winningMoves(classicPuzzle("e2e-win")));

    const dialog = page.getByRole("dialog", { name: /You won/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Play again" }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByTestId("score")).toHaveText("0");
    await expect(page.getByText("Classic · board e2e-win")).toBeHidden();
    await expect(page.getByTestId("total-wins")).toHaveText("1");
    await expect(page.getByTestId("total-losses")).toHaveText("0");
    for (const index of [0, 1, 2, 3] as const) await expect(crystal(page, index)).toBeEnabled();
  });

  test("loses on a bust and shows the fewest clicks that would have won", async ({ page }) => {
    const puzzle = classicPuzzle("e2e-loss");
    await page.goto("/?mode=classic&board=e2e-loss");
    await clickAll(page, bustRoute(puzzle, "end"));

    const dialog = page.getByRole("dialog", { name: /Bust/ });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(`The fewest clicks possible was ${puzzle.minClicks}`),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();

    await expect(page.getByTestId("total-losses")).toHaveText("1");
    await expect(page.getByTestId("total-streak")).toHaveText("0");
    for (const index of [0, 1, 2, 3] as const) await expect(crystal(page, index)).toBeDisabled();
    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  });

  test("keeps the daily and classic rounds separate when switching modes", async ({ page }) => {
    await page.goto("/");
    const daily = dailyPuzzle(today());
    await crystal(page, 0).click();
    await page.getByRole("button", { name: "classic" }).click();
    await expect(page.getByTestId("score")).toHaveText("0");

    await page.getByRole("button", { name: "daily" }).click();
    await expect(page.getByTestId("score")).toHaveText(String(daily.values[0]));
  });

  test("copies a link to the board", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await page.goto("/?mode=classic&board=link-board");
    await clickAll(page, bustRoute(classicPuzzle("link-board"), "end"));

    const dialog = page.getByRole("dialog", { name: /Bust/ });
    await dialog.getByRole("button", { name: "Copy board link" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Copied!");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/\?mode=classic&board=[\w-]+$/);
  });
});

test.describe("presentation", () => {
  test.beforeEach(async ({ page }) => {
    await skipHelp(page);
  });

  test("fits a 320px wide screen without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await clickAll(page, winningMoves(dailyPuzzle(today())));
    await expect(page.getByRole("dialog", { name: /solved/ })).toBeVisible();
    await settle(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("drops movement when the system asks for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await crystal(page, 0).click();
    const animation = await crystal(page, 0)
      .locator(".animate-pop")
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toBe("none");
  });

  test("follows the system colour scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(light).not.toBe(dark);
  });
});
