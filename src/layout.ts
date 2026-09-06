import type { Component } from "./model";
export function inventoryLayout(components: Component[], aspect: number) {
  const items = components.map((c) => ({
    id: c.part.id,
    width: Math.max(c.size.x, 0.24) + 0.2,
    height: Math.max(c.size.y, 0.2) + 0.3,
  }));
  const area = items.reduce((n, c) => n + c.width * c.height, 0);
  const target = Math.max(
    3.2,
    Math.sqrt(area * Math.max(0.3, Math.min(3, aspect))) * 1.1,
  );
  let x = 0,
    y = 0,
    row = 0,
    width = 0;
  const cells = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  for (const item of items) {
    if (x > 0 && x + item.width > target) {
      x = 0;
      y += row;
      row = 0;
    }
    cells.set(item.id, {
      x: x + item.width / 2,
      y: -y - item.height / 2,
      width: item.width,
      height: item.height,
    });
    x += item.width;
    row = Math.max(row, item.height);
    width = Math.max(width, x);
  }
  const height = y + row;
  cells.forEach((c) => {
    c.x -= width / 2;
    c.y += height / 2;
  });
  return { cells, width, height };
}
