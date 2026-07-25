/**
 * @vitest-environment node
 *
 * Unit tests for planning validation schemas.
 */

import { describe, it, expect } from "vitest";
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  changeTaskStatusSchema,
} from "../planning";

describe("createTaskSchema", () => {
  it("accepts minimal valid input", () => {
    const result = createTaskSchema.safeParse({ title: "My Task" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.priority).toBe("normal");
  });

  it("rejects empty title", () => {
    const result = createTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only title", () => {
    const result = createTaskSchema.safeParse({ title: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects title over 500 chars", () => {
    const result = createTaskSchema.safeParse({ title: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = createTaskSchema.safeParse({ title: "Task", priority: "extreme" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid priorities", () => {
    for (const p of ["low", "normal", "high", "urgent"]) {
      const result = createTaskSchema.safeParse({ title: "Task", priority: p });
      expect(result.success).toBe(true);
    }
  });

  it("rejects non-UUID assigned_to", () => {
    const result = createTaskSchema.safeParse({ title: "Task", assigned_to: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts null assigned_to", () => {
    const result = createTaskSchema.safeParse({ title: "Task", assigned_to: null });
    expect(result.success).toBe(true);
  });

  it("accepts valid UUID assigned_to", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      assigned_to: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("trims title", () => {
    const result = createTaskSchema.safeParse({ title: "  trimmed  " });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("trimmed");
  });
});

describe("updateTaskSchema", () => {
  it("requires id", () => {
    const result = updateTaskSchema.safeParse({ title: "Task", priority: "normal" });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID id", () => {
    const result = updateTaskSchema.safeParse({
      id: "not-uuid",
      title: "Task",
      priority: "normal",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid update input", () => {
    const result = updateTaskSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Updated Task",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });
});

describe("changeTaskStatusSchema", () => {
  it("accepts valid status transitions", () => {
    for (const s of ["open", "in_progress", "completed", "cancelled"]) {
      const result = changeTaskStatusSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        status: s,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = changeTaskStatusSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });
});

describe("assignTaskSchema", () => {
  it("accepts null assigned_to (unassign)", () => {
    const result = assignTaskSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      assigned_to: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid UUID assigned_to", () => {
    const result = assignTaskSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      assigned_to: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID assigned_to", () => {
    const result = assignTaskSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      assigned_to: "not-uuid",
    });
    expect(result.success).toBe(false);
  });
});
