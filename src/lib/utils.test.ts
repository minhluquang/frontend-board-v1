import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn class-name helper", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditionals and falsy values", () => {
    expect(cn("foo", false && "bar", null, undefined, "baz")).toBe("foo baz");
  });

  it("resolves conflicting tailwind utility classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});
