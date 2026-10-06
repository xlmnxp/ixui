import axe from "axe-core";

/** Fail with a readable list when axe finds violations. Colour contrast is skipped: jsdom has no layout/styles. */
export async function expectNoA11yViolations(root: Element = document.body): Promise<void> {
  const results = await axe.run(root, { rules: { "color-contrast": { enabled: false } } });
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  ${n.html.slice(0, 120)}`).join("\n")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}
