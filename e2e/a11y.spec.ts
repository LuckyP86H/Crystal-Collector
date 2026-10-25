import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { classicPuzzle, dailyPuzzle } from "../shared/engine";
import {
  bustRoute,
  clickAll,
  expect,
  settle,
  skipHelp,
  test,
  today,
  winningMoves,
} from "./support";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  await settle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    violations.map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes
          .map((node) => node.target.join(" "))
          .join("\n  ")}`,
    ),
    "axe found accessibility violations",
  ).toEqual([]);
}

for (const colorScheme of ["dark", "light"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("the help dialog", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("dialog", { name: "How to play" })).toBeVisible();
      await expectNoViolations(page);
    });

    test("the daily board, before and during play", async ({ page }) => {
      await skipHelp(page);
      await page.goto("/");
      await expect(page.getByTestId("target")).toBeVisible();
      await expectNoViolations(page);

      await clickAll(page, [0, 1]);
      await expectNoViolations(page);
    });

    test("the daily result dialog", async ({ page }) => {
      await skipHelp(page);
      await page.goto("/");
      await clickAll(page, winningMoves(dailyPuzzle(today())));
      await expect(page.getByRole("dialog", { name: /solved/ })).toBeVisible();
      await expect(page.getByText(/ranked #\d+ of \d+/)).toBeVisible();
      await expectNoViolations(page);
    });

    test("a lost classic round", async ({ page }) => {
      await skipHelp(page);
      await page.goto("/?mode=classic&board=a11y-loss");
      await clickAll(page, bustRoute(classicPuzzle("a11y-loss"), "end"));
      await expect(page.getByRole("dialog", { name: /Bust/ })).toBeVisible();
      await expectNoViolations(page);
    });
  });
}
