import { describe, expect, it, vi } from "vitest";
import { mapStackOrder, moveLayerOrder, reconcileLayerOrder, syncMapStack } from "./layer-order";

describe("layer ordering", () => {
  const rows = [{ id: "old" }, { id: "middle" }, { id: "new" }];

  it("starts with the bottommost Sheets row first in the sidebar", () => {
    expect(reconcileLayerOrder(rows.map((row) => row.id), [])).toEqual(["new", "middle", "old"]);
  });

  it("starts with the newest row in front on the map", () => {
    expect(mapStackOrder([...rows].reverse(), false).map((row) => row.id)).toEqual(["old", "middle", "new"]);
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

  it("retains manual positions during refresh and prepends newly added sheet rows", () => {
    expect(reconcileLayerOrder(["old", "new", "latest"], ["new", "removed", "old"])).toEqual(["latest", "new", "old"]);
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