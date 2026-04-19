/**
 * Lightweight HTML sanitizer — strips dangerous tags/attributes
 * while preserving safe formatting (p, br, strong, em, ul, ol, li, a, h1-h6, etc.)
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
  'span', 'div', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'sup', 'sub', 'mark', 'del', 'ins', 'figure', 'figcaption',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  '*': new Set(['class', 'id']),
};

const DANGEROUS_PROTOCOLS = /^\s*(javascript|data|vbscript)\s*:/i;

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  // Remove script/style/iframe tags and their content entirely
  let clean = dirty
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s>][\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s>][\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s>][\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s>][\s\S]*?<\/embed>/gi, '')
    .replace(/<form[\s>][\s\S]*?<\/form>/gi, '');

  // Remove event handlers (onclick, onerror, onload, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Process remaining tags
  clean = clean.replace(/<\/?([a-z][a-z0-9]*)((?:\s+[^>]*)?)\s*\/?>/gi, (match, tag, attrs) => {
    const tagLower = tag.toLowerCase();

    // Strip disallowed tags
    if (!ALLOWED_TAGS.has(tagLower)) return '';

    // Closing tag
    if (match.startsWith('</')) return `</${tagLower}>`;

    // Filter attributes
    const allowedForTag = ALLOWED_ATTRS[tagLower] || new Set();
    const globalAllowed = ALLOWED_ATTRS['*'];
    const filteredAttrs: string[] = [];

    const attrRegex = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      if (!allowedForTag.has(attrName) && !globalAllowed.has(attrName)) continue;

      // Block dangerous protocols in href/src
      if ((attrName === 'href' || attrName === 'src') && DANGEROUS_PROTOCOLS.test(attrValue)) continue;

      // Force rel=noopener on links
      if (tagLower === 'a' && attrName === 'href') {
        filteredAttrs.push(`href="${attrValue}"`);
        filteredAttrs.push('rel="noopener noreferrer"');
        continue;
      }

      filteredAttrs.push(`${attrName}="${attrValue}"`);
    }

    const selfClosing = match.endsWith('/>') || tagLower === 'br' || tagLower === 'hr' || tagLower === 'img';
    const attrStr = filteredAttrs.length > 0 ? ' ' + filteredAttrs.join(' ') : '';
    return selfClosing ? `<${tagLower}${attrStr} />` : `<${tagLower}${attrStr}>`;
  });

  return clean;
}
