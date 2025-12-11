import { describe, it, expect } from "vitest";

// Simple utility functions to test
function add(a: number, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

function isEven(num: number): boolean {
  return num % 2 === 0;
}

describe("Basic Utility Functions", () => {
  describe("add", () => {
    it("should add two positive numbers", () => {
      expect(add(2, 3)).toBe(5);
    });

    it("should add negative numbers", () => {
      expect(add(-1, -1)).toBe(-2);
    });

    it("should add zero", () => {
      expect(add(5, 0)).toBe(5);
    });
  });

  describe("multiply", () => {
    it("should multiply two positive numbers", () => {
      expect(multiply(3, 4)).toBe(12);
    });

    it("should multiply by zero", () => {
      expect(multiply(5, 0)).toBe(0);
    });

    it("should multiply negative numbers", () => {
      expect(multiply(-2, -3)).toBe(6);
    });
  });

  describe("isEven", () => {
    it("should return true for even numbers", () => {
      expect(isEven(2)).toBe(true);
      expect(isEven(4)).toBe(true);
      expect(isEven(100)).toBe(true);
    });

    it("should return false for odd numbers", () => {
      expect(isEven(1)).toBe(false);
      expect(isEven(3)).toBe(false);
      expect(isEven(99)).toBe(false);
    });

    it("should handle zero as even", () => {
      expect(isEven(0)).toBe(true);
    });
  });
});

// Test that global test APIs are available
describe("Vitest Globals", () => {
  it("should have access to global test APIs", () => {
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
    expect(typeof expect).toBe("function");
    expect(typeof vi).toBe("object"); // vi is an object with methods like fn(), mock(), etc.
    expect(typeof vi.fn).toBe("function");
  });
});
