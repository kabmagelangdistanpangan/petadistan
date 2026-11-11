import { describe, it, expect } from "vitest";
import { parseCoordinate } from "./coords";
describe("parseCoordinate", () => {
  it("reads lat, lng", () => expect(parseCoordinate("-7.48512, 110.22341")).toEqual([110.22341, -7.48512]));
  it("reads space separated", () => expect(parseCoordinate("-7.48512 110.22341")).toEqual([110.22341, -7.48512]));
  it("fixes swapped order", () => expect(parseCoordinate("110.22341, -7.48512")).toEqual([110.22341, -7.48512]));
  it("ignores map names", () => expect(parseCoordinate("irigasi")).toBeNull());
});
