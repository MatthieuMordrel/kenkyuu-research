import { describe, it, expect } from "vitest";
import { escapeHtml } from "../notifications";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
    );
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('She said "hello"')).toBe("She said &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("handles strings with no special characters", () => {
    expect(escapeHtml("plain text")).toBe("plain text");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes all special characters together", () => {
    expect(escapeHtml(`<div class="test">'A & B'</div>`)).toBe(
      "&lt;div class=&quot;test&quot;&gt;&#039;A &amp; B&#039;&lt;/div&gt;",
    );
  });

  it("escapes multiple occurrences of the same character", () => {
    expect(escapeHtml("<<>>")).toBe("&lt;&lt;&gt;&gt;");
    expect(escapeHtml("&&&&")).toBe("&amp;&amp;&amp;&amp;");
  });
});
