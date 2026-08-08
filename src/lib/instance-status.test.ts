import { instanceStatusTone } from "./instance-status";

describe("instanceStatusTone", () => {
  it("maps Started to success", () => {
    expect(instanceStatusTone("Started")).toBe("success");
  });
  it("maps Error to danger", () => {
    expect(instanceStatusTone("Error")).toBe("danger");
  });
  it("maps unknown to neutral", () => {
    expect(instanceStatusTone("WeirdState")).toBe("neutral");
  });
});
