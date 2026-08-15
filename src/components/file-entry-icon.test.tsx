import { render } from "@testing-library/react";
import { FileEntryIcon, fileTypeLabel } from "./file-entry-icon";

describe("FileEntryIcon", () => {
  it("renders the right icon per type", () => {
    const dir = render(<FileEntryIcon type="directory" />);
    expect(dir.container.querySelector(".lucide-folder")).toBeInTheDocument();
    const file = render(<FileEntryIcon type="file" />);
    expect(file.container.querySelector(".lucide-file-text")).toBeInTheDocument();
    const link = render(<FileEntryIcon type="symlink" />);
    expect(link.container.querySelector(".lucide-link-2")).toBeInTheDocument();
    const unknown = render(<FileEntryIcon type={null} />);
    expect(unknown.container.querySelector(".lucide-file")).toBeInTheDocument();
  });

  it("accepts a custom size", () => {
    const view = render(<FileEntryIcon type="directory" size={18} />);
    expect(view.container.querySelector("svg")).toHaveAttribute("width", "18");
  });

  it("labels types", () => {
    expect(fileTypeLabel("directory")).toBe("Directory");
    expect(fileTypeLabel("file")).toBe("File");
    expect(fileTypeLabel("symlink")).toBe("Symlink");
    expect(fileTypeLabel(null)).toBe("—");
  });
});
