import { describe, expect, it } from "vitest";
import { parseContent } from "../../src/communications.js";
describe("communication plain text contract", () => {
  it.each([null, [], {}, { content: " \n\t " }, { content: 12 }, { content: "x", authorId: 1 }, { content: "x", createdAt: "2020" }, { content: "x\0" }, { content: "😀".repeat(2001) }])("rejects invalid or forged body %j", body => {
    expect(() => parseContent(body)).toThrow();
  });
  it("counts Unicode code points and keeps markup as plain text", () => {
    expect(parseContent({ content: ` ${"😀".repeat(2000)} ` })).toHaveLength(4000);
    expect(parseContent({ content: " <script>alert(1)</script> " })).toBe("<script>alert(1)</script>");
  });
});
