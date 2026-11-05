import { describe, expect, it, vi } from "vitest";
import { dragLayerOrder, mapStackOrder, moveLayerOrder, reconcileLayerOrder, syncMapStack } from "./layer-order";

describe("layer ordering", () => {
  it("drags directly across several rows in both directions", () => {
    expect(dragLayerOrder(["new", "middle", "old"], "new", "old")).toEqual(["middle", "old", "new"]);
    expect(dragLayerOrder(["new", "middle", "old"], "old", "new")).toEqual(["old", "new", "middle"]);
  });

  it("ignores canceled or unchanged drops and preserves hidden rows", () => {
    const order = ["new", "hidden", "old"];
    expect(dragLayerOrder(order, "new", "missing")).toBe(order);
    expect(dragLayerOrder(order, "new", "new")).toBe(order);
    expect(dragLayerOrder(order, "new", "old")).toEqual(["hidden", "old", "new"]);
  });

  it("places a dragged lower row above other data on the map", () => {
    const order = dragLayerOrder(["new", "middle", "old"], "new", "old");
    expect(mapStackOrder(order.map((id) => ({ id })), true).at(-1)?.id).toBe("new");
  });
  const rows = [{ id: "old" }, { id: "middle" }, { id: "new" }];

  it("follows Sheets row order in the sidebar", () => {
    expect(reconcileLayerOrder(rows.map((row) => row.id), [])).toEqual(["old", "middle", "new"]);
  });

  it("puts the topmost Sheets row at the bottom of the map stack", () => {
    expect(mapStackOrder(rows, true).map((row) => row.id)).toEqual(["old", "middle", "new"]);
  });

  it("moves a row down and immediately makes lower sidebar rows higher in the map stack", () => {
    const moved = moveLayerOrder(["new", "middle", "old"], "new", 1);
    expect(moved).toEqual(["middle", "new", "old"]);
    expect(mapStackOrder(moved.map((id) => ({ id })), true).map((row) => row.id)).toEqual(moved);
  });

  it("moves a row up and leaves end positions unchanged", () => {
    expect(moveLayerOrder(["new", "middle", "old"], "old", -1)).toEqual(["new", "old", "middle"]);
    expect(moveLayerOrder(["new", "old"], "new", -1)).toEqual(["new", "old"]);
    expect(moveLayerOrder(["new", "old"], "old", 1)).toEqual(["new", "old"]);
  });

  it("retains manual positions during refresh and appends newly added sheet rows", () => {
    expect(reconcileLayerOrder(["old", "new", "latest"], ["new", "removed", "old"])).toEqual(["new", "old", "latest"]);
  });

  it.each([false, true])("keeps administrative boundaries underneath data in manual=%s", (manual) => {
    expect(mapStackOrder([{ id: "new" }, { id: "boundary", boundary: true }, { id: "old" }], manual)[0]?.id).toBe("boundary");
  });

  it("reorders every rendered geometry and label, regardless of source load order", () => {
    const stack = ["lyr-new-fill", "lyr-new-line", "lyr-new-pt", "lyr-new-lbl", "lyr-old-fill", "lyr-old-line", "lyr-old-pt", "lyr-old-lbl"];
    const moveLayer = vi.fn((id: string) => { stack.splice(stack.indexOf(id), 1); stack.push(id); });
    syncMapStack({ getLayer: (id) => stack.includes(id), moveLayer }, [{ id: "old" }, { id: "new" }]);
    expect(stack.slice(-4)).toEqual(["lyr-new-fill", "lyr-new-line", "lyr-new-pt", "lyr-new-lbl"]);
    expect(moveLayer).toHaveBeenCalledTimes(8);
  });
});
import { groupByCategory, dragCategoryOrder } from "./layer-order";
describe("category blocks", () => {
  const kat: Record<string, string> = { a: "Administrasi", b: "LP2B", c: "administrasi", d: "Pupuk" };
  const of = (id: string) => kat[id]!;
  it("merges the same category into one block", () => {
    expect(groupByCategory(["a", "b", "c", "d"], of)).toEqual(["a", "c", "b", "d"]);
  });
  it("moves a whole category block", () => {
    expect(dragCategoryOrder(["a", "c", "b", "d"], of, "Administrasi", "Pupuk")).toEqual(["b", "d", "a", "c"]);
  });
});

import { sheetSidebarOrder as sso } from "./layer-order";
describe("sheetSidebarOrder", () => {
  it("puts the category of sheet row 1 at the bottom with its members", () => {
    const kat: Record<string, string> = { a: "Administrasi", b: "LP2B", c: "Pupuk", d: "Administrasi" };
    expect(sso(["a", "b", "c", "d"], (id) => kat[id] ?? "")).toEqual(["c", "b", "d", "a"]);
  });
});
