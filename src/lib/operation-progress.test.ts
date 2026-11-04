import { operationProgress, operationProgressInfo, operationProgressText } from "./operation-progress";
import type { Operation } from "../api/types";

const op = (metadata?: Record<string, unknown>): Operation => ({
  id: "op1",
  class: "task",
  description: "Creating instance",
  status: "Running",
  status_code: 103,
  created_at: "",
  updated_at: "",
  may_cancel: false,
  metadata,
});

// Payloads captured from GET /1.0/operations/{id} while creating a container
// on a cluster member.
const DOWNLOAD = { download_progress: "rootfs: 46% (7.76MB/s)" };
const UNPACK_NO_PERCENT = {
  create_instance_from_image_unpack_progress: "Unpacking image",
  progress: { speed: "0", stage: "create_instance_from_image_unpack" },
};
const UNPACK_DONE = {
  create_instance_from_image_unpack_progress: "Unpacking image: 100%",
  progress: { percent: "100", speed: "0", stage: "create_instance_from_image_unpack" },
};

describe("operationProgress", () => {
  it("tracks the download percentage", () => {
    expect(operationProgress(op(DOWNLOAD))).toBe(46);
    expect(operationProgressText(op(DOWNLOAD))).toBe("rootfs: 46% (7.76MB/s)");
  });

  it("has no percentage while the unpack stage reports none", () => {
    expect(operationProgress(op(UNPACK_NO_PERCENT))).toBeUndefined();
    // The human stage string still tells the user what is happening.
    expect(operationProgressText(op(UNPACK_NO_PERCENT))).toBe("Unpacking image");
  });

  it("reads the finished unpack stage", () => {
    expect(operationProgress(op(UNPACK_DONE))).toBe(100);
    expect(operationProgressText(op(UNPACK_DONE))).toBe("Unpacking image: 100%");
  });

  it("tracks the least-advanced stage when several are reported", () => {
    const metadata = { ...UNPACK_DONE, download_progress: "rootfs: 100% (0MB/s)" };
    expect(operationProgress(op(metadata))).toBe(100);
    const mixed = { download_progress: "rootfs: 40% (1MB/s)", ...UNPACK_DONE };
    expect(operationProgress(op(mixed))).toBe(40);
    expect(operationProgressText(op(mixed))).toBe("rootfs: 40% (1MB/s)");
  });

  it("clamps and rejects unusable values", () => {
    expect(operationProgress(op({ progress: 140 }))).toBe(100);
    expect(operationProgress(op({ progress: -3 }))).toBe(0);
    expect(operationProgress(op())).toBeUndefined();
    expect(operationProgress(op({ download_progress: "starting" }))).toBeUndefined();
  });
});

describe("operationProgressInfo", () => {
  it("falls back to the humanised stage when no string exists", () => {
    expect(operationProgressInfo(op({ progress: { percent: "10", stage: "create_instance_from_image_unpack" } }))).toEqual({
      percent: 10,
      text: "Create instance from image unpack",
    });
  });
});
