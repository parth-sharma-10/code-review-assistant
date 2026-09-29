import { cleanup, fireEvent, render as rtlRender, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReviewIssue } from "@/lib/types";
import { CodeViewer } from "./code-viewer";
import { TooltipProvider } from "./ui";

// The app mounts TooltipProvider at the root (components/providers.tsx); tests need it too.
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: TooltipProvider });

// Highlighting is async and irrelevant here; plain-text rendering is the fallback path anyway.
vi.mock("@/lib/highlight", () => ({
  tokenize: async () => null,
  KEYWORD_COLOR: "",
  MAX_HIGHLIGHT_CHARS: 200_000,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const issue = (line: number | null, title: string): ReviewIssue => ({
  title,
  description: "d",
  severity: "HIGH",
  file: "a.ts",
  line,
  recommendation: "r",
});

describe("CodeViewer", () => {
  const content = "const a = 1;\nconst b = 2;\nconst c = 3;";

  it("pins a finding directly beneath the line it cites", () => {
    render(<CodeViewer path="a.ts" content={content} annotations={[issue(2, "Bad b")]} />);
    const rows = screen.getAllByRole("row");
    const lineTwo = rows.findIndex((r) => r.textContent?.includes("const b = 2;"));
    expect(within(rows[lineTwo + 1]).getByText("Bad b")).toBeTruthy();
    expect(rows[lineTwo + 2].textContent).toContain("const c = 3;");
  });

  it("shows findings without a usable line number above the listing", () => {
    render(
      <CodeViewer
        path="a.ts"
        content={content}
        annotations={[issue(null, "General"), issue(99, "Past end")]}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).queryByText("General")).toBeNull();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Past end")).toBeTruthy();
  });

  it("numbers every line", () => {
    render(<CodeViewer path="a.ts" content={content} />);
    expect(screen.getAllByRole("row").map((r) => r.firstChild?.textContent)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("in hunk mode shows only lines near a finding, and a gap expands in place", () => {
    const long = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    render(<CodeViewer path="a.ts" content={long} annotations={[issue(10, "Here")]} context={2} />);
    expect(screen.queryByText("line 7")).toBeNull();
    expect(screen.getByText("line 8")).toBeTruthy();
    expect(screen.getByText("line 12")).toBeTruthy();
    expect(screen.queryByText("line 13")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show lines 1–7" }));
    expect(screen.getByText("line 1")).toBeTruthy();
    expect(screen.getByText("line 7")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show lines 13–20" })).toBeTruthy();
  });
});
