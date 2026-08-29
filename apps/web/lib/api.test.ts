import { beforeEach, describe, expect, it } from "vitest";

import { clearToken, getToken } from "./api";

describe("anonymous token brand migration", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => [...values.keys()][index] ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
        get length() { return values.size; },
      } satisfies Storage,
    });
  });

  it("copies the legacy token into the Tea-BTI key without deleting the backup", () => {
    window.localStorage.setItem("shuacha.anonymousToken", "legacy-token");

    expect(getToken()).toBe("legacy-token");
    expect(window.localStorage.getItem("tea-bti.anonymousToken")).toBe("legacy-token");
    expect(window.localStorage.getItem("shuacha.anonymousToken")).toBe("legacy-token");
  });

  it("prefers the Tea-BTI key and clears both keys when the session is invalid", () => {
    window.localStorage.setItem("tea-bti.anonymousToken", "current-token");
    window.localStorage.setItem("shuacha.anonymousToken", "legacy-token");

    expect(getToken()).toBe("current-token");
    clearToken();
    expect(getToken()).toBeNull();
  });
});
