import { act, render, screen } from "@testing-library/react";
import { ConnectionBanner } from "./connection-banner";
import { connectionStore } from "../state/connection";

vi.mock("../state/instances", () => ({ loadInstances: vi.fn() }));

describe("ConnectionBanner", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    act(() => connectionStore.setState("connecting"));
    vi.useRealTimers();
  });

  it("appears only after a sustained disconnect and clears on reconnect", () => {
    render(<ConnectionBanner />);
    act(() => connectionStore.setState("disconnected"));
    expect(screen.queryByTestId("connection-banner")).toBeNull();
    act(() => void vi.advanceTimersByTime(3_100));
    expect(screen.getByTestId("connection-banner")).toBeInTheDocument();
    act(() => connectionStore.setState("connected"));
    expect(screen.queryByTestId("connection-banner")).toBeNull();
  });
});
