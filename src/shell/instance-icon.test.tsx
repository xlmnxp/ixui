import { render, screen } from "@testing-library/react";
import { InstanceIcon, instanceDotClass } from "./instance-icon";

describe("instanceDotClass", () => {
  it("maps running states to success", () => {
    expect(instanceDotClass("Running")).toBe("bg-success");
    expect(instanceDotClass("Started")).toBe("bg-success");
  });
  it("maps stopped to neutral and error to danger", () => {
    expect(instanceDotClass("Stopped")).toBe("bg-text-tertiary");
    expect(instanceDotClass("Error")).toBe("bg-danger");
  });
});

describe("InstanceIcon", () => {
  it("renders a container icon with a status dot", () => {
    render(<InstanceIcon status="Running" type="container" />);
    expect(screen.getByTestId("instance-icon")).toHaveTextContent("");
    expect(screen.getByTestId("instance-icon").querySelector(".bg-success")).toBeInTheDocument();
  });
});
