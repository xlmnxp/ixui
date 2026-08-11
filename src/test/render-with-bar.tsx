import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { PageBar } from "../shell/page-bar";
import { pageBarStore } from "../state/page-bar";

export function renderWithBar(ui: ReactElement) {
  return render(
    <>
      <PageBar />
      {ui}
    </>
  );
}

export function resetPageBar() {
  pageBarStore.setState(null);
}
