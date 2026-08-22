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
  it("renders a container icon with a green play icon for running", () => {
    render(<InstanceIcon status="Running" type="container" />);
    expect(screen.getByTestId("instance-icon")).toHaveTextContent("");
    expect(screen.getByTestId("instance-icon").querySelector(".text-success")).toBeInTheDocument();
  });

  it("renders a stopped VM icon dimmed without a sub icon", () => {
    render(<InstanceIcon status="Stopped" type="virtual-machine" />);
    const icon = screen.getByTestId("instance-icon");
    expect(icon.querySelector("svg")).toBeInTheDocument();
    expect(icon.querySelector(".text-success")).not.toBeInTheDocument();
    expect(icon.querySelector(".bg-text-tertiary")).not.toBeInTheDocument();
  });
});
