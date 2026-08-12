import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CertificatesPage } from "./certificates";

vi.mock("../api", () => ({
  certificatesApi: {
    list: vi.fn().mockResolvedValue([
      { fingerprint: "fpr-abc", type: "client", name: "laptop", certificate: "cert-data", restricted: true, projects: ["default"] },
      { fingerprint: "fpr-def", type: "client", name: "desktop", certificate: "cert-data", restricted: false, projects: [] },
    ]),
    createToken: vi.fn().mockResolvedValue({ token: "tok-123" }),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("CertificatesPage", () => {
  it("lists certificates", async () => {
    render(<CertificatesPage />);
    expect(await screen.findByText("fpr-abc")).toBeInTheDocument();
    expect(screen.getByText("laptop")).toBeInTheDocument();
    expect(screen.getByText("desktop")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
  });

  it("issues a token and copies it", async () => {
    const user = userEvent.setup();
    const { certificatesApi } = await import("../api");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<CertificatesPage />);
    await screen.findByText("fpr-abc");
    await user.click(screen.getByTestId("certificate-issue-open"));
    await user.type(screen.getByTestId("token-description"), "laptop");
    await user.type(screen.getByTestId("token-expiry"), "2026-12-31");
    await user.click(screen.getByTestId("token-issue-submit"));
    await waitFor(() =>
      expect(certificatesApi.createToken).toHaveBeenCalledWith("laptop", "2026-12-31T23:59:59Z")
    );
    expect(await screen.findByTestId("token-value")).toHaveTextContent("tok-123");
    await user.click(screen.getByTestId("token-copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("tok-123"));
  });
});
