import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthScreen } from "./auth-screen";
import { authStore, markForbidden, markAuthenticated } from "./status";
import { startOidcLogin, startOidcLogout } from "./login";

describe("auth status", () => {
  it("transitions on forbidden and success", () => {
    expect(authStore.getState()).toBe("unknown");
    markForbidden();
    expect(authStore.getState()).toBe("unauthenticated");
    markAuthenticated();
    expect(authStore.getState()).toBe("authenticated");
  });
});

describe("startOidcLogin", () => {
  it("redirects to oidc login with path", () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/instances/web1", search: "", assign },
      writable: true,
    });
    startOidcLogin();
    expect(assign).toHaveBeenCalledWith("/oidc/login?path=%2Finstances%2Fweb1");
  });
});

describe("startOidcLogout", () => {
  it("redirects to oidc logout", () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign },
      writable: true,
    });
    startOidcLogout();
    expect(assign).toHaveBeenCalledWith("/oidc/logout");
  });
});

describe("AuthScreen", () => {
  it("renders and triggers retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<AuthScreen onRetry={onRetry} />);
    expect(screen.getByTestId("auth-screen")).toBeInTheDocument();
    expect(screen.getByTestId("oidc-login")).toBeInTheDocument();
    await user.click(screen.getByTestId("auth-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
