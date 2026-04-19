import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("sanitizeHtml", () => {
  it("returns empty string for falsy input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("strips script tags and content", () => {
    const input = '<p>safe</p><script>alert(1)</script>';
    expect(sanitizeHtml(input)).not.toContain("script");
    expect(sanitizeHtml(input)).toContain("safe");
  });

  it("strips iframe entirely", () => {
    const input = '<iframe src="https://evil.com"></iframe><p>ok</p>';
    expect(sanitizeHtml(input)).not.toContain("iframe");
  });

  it("removes inline event handlers", () => {
    const input = '<a href="/x" onclick="alert(1)">click</a>';
    expect(sanitizeHtml(input)).not.toContain("onclick");
  });

  it("blocks javascript: protocol in href", () => {
    const input = '<a href="javascript:alert(1)">x</a>';
    const out = sanitizeHtml(input);
    expect(out).not.toContain("javascript:");
  });

  it("blocks data: protocol in src", () => {
    const input = '<img src="data:text/html;base64,xxx" />';
    expect(sanitizeHtml(input)).not.toContain("data:");
  });

  it("forces rel noopener on links", () => {
    const input = '<a href="https://x.com">link</a>';
    expect(sanitizeHtml(input)).toContain('rel="noopener noreferrer"');
  });

  it("preserves allowed tags and class attribute", () => {
    const input = '<p class="lead">hello <strong>world</strong></p>';
    const out = sanitizeHtml(input);
    expect(out).toContain('class="lead"');
    expect(out).toContain("<strong>");
  });

  it("strips standard disallowed tag and keeps inner content", () => {
    const input = '<unknowntag>raw</unknowntag>';
    const out = sanitizeHtml(input);
    expect(out).not.toContain("<unknowntag>");
    expect(out).toContain("raw");
  });
});
