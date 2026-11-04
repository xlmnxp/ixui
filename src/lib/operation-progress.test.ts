import { operationProgress, isOperationRunning } from "./operation-progress";
import type { Operation } from "../api/types";

const op = (over: Partial<Operation> = {}): Operation => ({
  id: "op1",
  class: "task",
  description: "Downloading image",
  status: "Running",
  status_code: 103,
  created_at: "",
  updated_at: "",
  may_cancel: false,
  ...over,
});

describe("operationProgress", () => {
  it("reads the daemon's download percentage", () => {
    expect(operationProgress(op({ metadata: { download_progress: "42%" } }))).toBe(42);
    expect(operationProgress(op({ metadata: { download_progress: "7.6%" } }))).toBe(8);
  });

  it("accepts numeric progress and clamps it", () => {
    expect(operationProgress(op({ metadata: { progress: 55 } }))).toBe(55);
    expect(operationProgress(op({ metadata: { progress: 140 } }))).toBe(100);
    expect(operationProgress(op({ metadata: { progress: -3 } }))).toBe(0);
  });

  it("returns undefined when no percentage is reported", () => {
    expect(operationProgress(op())).toBeUndefined();
    expect(operationProgress(op({ metadata: { download_progress: "starting" } }))).toBeUndefined();
  });
});

describe("isOperationRunning", () => {
  it("is true until the operation reaches a terminal status", () => {
    expect(isOperationRunning(op())).toBe(true);
    expect(isOperationRunning(op({ status: "Success", status_code: 200 }))).toBe(false);
    expect(isOperationRunning(op({ status: "Failure", status_code: 400 }))).toBe(false);
  });
});
