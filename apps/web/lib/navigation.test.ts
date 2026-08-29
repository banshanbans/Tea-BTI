import { describe, expect, it } from "vitest";

import { parseRealmEntry, parseTeaOrigin, realmExitHref, teaOriginHref } from "./navigation";

describe("navigation allowlists", () => {
  it("falls unknown tea origins back to swipe", () => {
    expect(parseTeaOrigin("outside")).toBe("swipe");
    expect(teaOriginHref(parseTeaOrigin(undefined))).toBe("/");
  });

  it("only accepts tea as a non-root realm entry", () => {
    expect(parseRealmEntry("tea")).toBe("tea");
    expect(parseRealmEntry("outside")).toBe("realm");
    expect(realmExitHref("tea", "duyun-maojian", "passport")).toBe("/tea/duyun-maojian?origin=passport");
    expect(realmExitHref("tea", undefined, "profile")).toBe("/realm");
  });
});
