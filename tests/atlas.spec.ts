import { test, expect } from "@playwright/test";
import { createCar } from "../src/model";
import { inventoryLayout } from "../src/layout";
import { initialState, isVisible, searchParts, SYSTEMS } from "../src/atlas";
import { PointerTap } from "../src/pointer-tap";

test("catalogue references, geometry, and inventory are complete", () => {
  const car = createCar(),
    parts = car.map((c) => c.part),
    ids = new Set(parts.map((p) => p.id));
  expect(ids.size).toBe(parts.length);
  expect(parts.length).toBeGreaterThan(70);
  for (const c of car) {
    expect(c.part.description.length).toBeGreaterThan(90);
    expect(SYSTEMS.some((s) => s.id === c.part.system)).toBe(true);
    for (const id of c.part.related)
      expect(ids.has(id), `${c.part.id} references ${id}`).toBe(true);
    c.group.traverse((o) => {
      if ("geometry" in o) {
        const g = (o as import("three").Mesh).geometry;
        const p = g.getAttribute("position");
        expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      }
    });
  }
  for (const aspect of [0.35, 0.75, 1.5, 3]) {
    const layout = inventoryLayout(car, aspect);
    const cells = [...layout.cells.values()];
    expect(cells.length).toBe(car.length);
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i],
          b = cells[j];
        const overlapX = (a.width + b.width) / 2 - Math.abs(a.x - b.x),
          overlapY = (a.height + b.height) / 2 - Math.abs(a.y - b.y);
        expect(overlapX > 1e-8 && overlapY > 1e-8).toBe(false);
      }
  }
  expect(searchParts(parts, "V6")[0].id).toBe("engine");
  expect(searchParts(parts, "left front brake").length).toBeGreaterThan(0);
  expect(searchParts(parts, "nothing-matches")).toHaveLength(0);
  expect(
    parts
      .filter((p) =>
        isVisible(p, { ...initialState, visible: [], selected: "engine" }),
      )
      .map((p) => p.id),
  ).toEqual(["engine"]);
  expect(
    parts
      .filter((p) =>
        isVisible(p, { ...initialState, isolate: true, selected: "engine" }),
      )
      .map((p) => p.id),
  ).toEqual(["engine"]);
  car.forEach((c) =>
    c.group.traverse((o) => {
      if ("geometry" in o) {
        const m = o as import("three").Mesh;
        m.geometry.dispose();
        (m.material as import("three").Material).dispose();
      }
    }),
  );
});
test("tap detector rejects drags, multi-touch, and cancellation", () => {
  const t = new PointerTap();
  t.down(1, 10, 10, 5);
  expect(t.up(1, 12, 12)).toBe(true);
  t.down(1, 10, 10, 5);
  t.move(1, 30, 10);
  expect(t.up(1, 10, 10)).toBe(false);
  t.down(1, 10, 10, 12);
  t.down(2, 20, 20, 12);
  expect(t.up(2, 20, 20)).toBe(false);
  expect(t.up(1, 10, 10)).toBe(false);
  t.down(1, 10, 10, 5);
  t.cancel(1);
  expect(t.up(1, 10, 10)).toBe(false);
});
test("desktop explorer supports search, isolation, layers, and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("car-canvas")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Find a component" }).click();
  await page
    .getByRole("textbox", { name: "Search components" })
    .fill("turbocharger");
  await page.getByRole("button", { name: "Turbocharger Power unit" }).click();
  await expect(
    page.getByRole("heading", { name: "Turbocharger", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Isolate component" }).click();
  await expect(
    page.getByRole("button", { name: "Show surrounding car" }),
  ).toBeVisible();
  await expect(page.locator(".sidebar-bottom")).toContainText("1 /");
  await page.getByRole("button", { name: "MGU-H", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "MGU-H", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close component details" }).click();
  await page.getByRole("tab", { name: /Systems/ }).click();
  await page.getByRole("button", { name: "Hide all", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No systems visible" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show complete car" }).click();
  await page.getByRole("button", { name: "Under the skin" }).click();
  await expect(
    page.getByRole("switch", { name: "Show Bodywork", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Color by system" }).click();
  await page.getByRole("button", { name: "Wireframe", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Wireframe", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("slider", { name: "Explode car" }).fill("100");
  await expect(page.getByTestId("car-canvas")).toHaveAttribute(
    "data-explode",
    "1.000",
    { timeout: 15000 },
  );
  await expect(page.locator(".inventory-label:not([hidden])")).toHaveCount(
    componentsCount(),
  );
  await expect(
    page.getByRole("button", { name: "Auto rotate" }),
  ).toBeDisabled();
  await page.screenshot({ path: "test-results/desktop-inventory.png" });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/desktop.png" });
  expect(errors).toEqual([]);
});
function componentsCount() {
  const car = createCar();
  const count = car.length;
  car.forEach((c) =>
    c.group.traverse((o) => {
      if ("geometry" in o) {
        const m = o as import("three").Mesh;
        m.geometry.dispose();
        (m.material as import("three").Material).dispose();
      }
    }),
  );
  return count;
}
test("canvas picking distinguishes a click from an orbit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "side view", exact: true }).click();
  await page.waitForTimeout(700);
  const canvas = page.getByTestId("car-canvas"),
    rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.6, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("complementary", { name: "Component details" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "side view", exact: true }).click();
  await page.waitForTimeout(500);
  // Probe the visible centre line of the body until an actual mesh is hit.
  for (const y of [0.45, 0.55, 0.65, 0.35]) {
    await canvas.click({
      position: { x: rect.width * 0.5, y: rect.height * y },
    });
    if (
      await page
        .getByRole("complementary", { name: "Component details" })
        .count()
    )
      break;
  }
  await expect(
    page.getByRole("complementary", { name: "Component details" }),
  ).toBeVisible();
});
for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`responsive explorer ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByTestId("car-canvas")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Find a part", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Search components" })
      .fill("front wing mainplane");
    await page
      .getByRole("button", { name: "Front wing mainplane Aerodynamics" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Front wing mainplane" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Isolate component" }).click();
    await page.waitForTimeout(500);
    const canvas = (await page.getByTestId("car-canvas").boundingBox())!,
      inspector = (await page
        .getByRole("complementary", { name: "Component details" })
        .boundingBox())!;
    if (viewport.width < 601)
      expect(canvas.y + canvas.height).toBeLessThanOrEqual(inspector.y + 2);
    else expect(canvas.x + canvas.width).toBeLessThanOrEqual(inspector.x + 2);
    await page.screenshot({
      path: `test-results/mobile-${viewport.width}-inspector.png`,
    });
    await page.getByRole("button", { name: "Close component details" }).click();
    await page.getByRole("button", { name: "Systems", exact: true }).click();
    await page
      .getByRole("switch", { name: "Show Aerodynamics", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close component explorer" })
      .click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `test-results/mobile-${viewport.width}.png`,
    });
  });
}
test("keyboard search, empty results, and accessible about dialog", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("car-canvas")).toBeVisible();
  await page.keyboard.press("/");
  await expect(
    page.getByRole("textbox", { name: "Search components" }),
  ).toBeFocused();
  await page.keyboard.type("xyz123");
  await expect(page.getByText("No matching components")).toBeVisible();
  await page
    .getByRole("button", { name: "Clear search", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "About this atlas" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
