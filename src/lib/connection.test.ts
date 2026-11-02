import { describe, expect, it } from "vitest";
import { describeConnectionError, isConnectionError } from "./connection";

describe("isConnectionError", () => {
  it("detects browser fetch failures", () => {
    expect(isConnectionError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isConnectionError(new Error("fetch failed"))).toBe(true);
    expect(
      isConnectionError(new TypeError("NetworkError when attempting to fetch resource.")),
    ).toBe(true);
  });

  it("detects paused-backend status codes like 530", () => {
    expect(isConnectionError(new Error("530 origin error"))).toBe(true);
    expect(isConnectionError({ status: 530, message: "nope" })).toBe(true);
    expect(isConnectionError(new Error("502 Bad Gateway"))).toBe(true);
  });

  it("detects timeouts and dropped connections", () => {
    expect(isConnectionError(new Error("The operation timed out"))).toBe(true);
    expect(isConnectionError(new Error("Connection reset by peer"))).toBe(true);
  });

  it("does not treat credential or validation errors as connection problems", () => {
    expect(isConnectionError(new Error("Invalid login credentials"))).toBe(false);
    expect(isConnectionError(new Error("Forbidden: you are not a member of this company"))).toBe(
      false,
    );
    expect(isConnectionError({ status: 400 })).toBe(false);
    expect(isConnectionError(null)).toBe(false);
  });
});

describe("describeConnectionError", () => {
  it("returns the message of real errors", () => {
    expect(describeConnectionError(new Error("boom"))).toBe("boom");
  });

  it("falls back for non-error values", () => {
    expect(describeConnectionError(undefined)).toBe("Unknown error");
  });
});
