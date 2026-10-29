import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../src/app/page";

// No credentials or network should be necessary to render the initial route.
describe("initial home route", () => {
  it("renders the product introduction and truthful availability without environment setup", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("ALKKAGI ARENA");
    expect(html).not.toContain("개발 중");
    expect(html).not.toContain("실제 플레이는 추후 제공됩니다.");
    expect(html).toContain("AI 연습전");
    expect(html).toContain('href="/lobby"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('<main');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});
