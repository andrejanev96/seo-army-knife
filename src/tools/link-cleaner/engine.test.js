import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  normalizeUrl,
  protectTemplateSyntax,
  restoreTemplateSyntax,
  analyzeHtml,
  computeAutoStrip,
  computeKeepAll,
  generateCleanHtml,
} from './engine';

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out).not.toContain('script');
  });

  it('strips on* event handler attributes', () => {
    const out = sanitizeHtml('<a href="/x" onclick="evil()">x</a>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('href="/x"');
  });

  it('strips javascript: hrefs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('removes iframe/object/embed', () => {
    const out = sanitizeHtml('<iframe src="x"></iframe><object data="x"></object>');
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('object');
  });
});

describe('normalizeUrl', () => {
  it('lowercases and strips trailing slash from path', () => {
    expect(normalizeUrl('https://EXAMPLE.com/Foo/')).toBe('/foo');
  });

  it('keeps query and fragment but lowercases them', () => {
    expect(normalizeUrl('https://e.com/a?B=1#C')).toBe('/a?b=1#c');
  });

  it('returns null for hash-only, mailto, tel, javascript', () => {
    expect(normalizeUrl('#')).toBeNull();
    expect(normalizeUrl('mailto:a@b.c')).toBeNull();
    expect(normalizeUrl('tel:+1')).toBeNull();
    expect(normalizeUrl('javascript:void(0)')).toBeNull();
  });

  it('handles relative paths', () => {
    expect(normalizeUrl('/about/')).toBe('/about');
    expect(normalizeUrl('/about/?q=X')).toBe('/about?q=x');
  });
});

describe('protectTemplateSyntax', () => {
  it('replaces {{...}} placeholders and restores them', () => {
    const html = '<p>Hello {{name}} and {{user.email}}</p>';
    const { html: protectedHtml, placeholders } = protectTemplateSyntax(html);
    expect(protectedHtml).not.toContain('{{');
    expect(placeholders).toHaveLength(2);
    expect(restoreTemplateSyntax(protectedHtml, placeholders)).toBe(html);
  });
});

describe('analyzeHtml', () => {
  const article = `<article>
    <h1>Test Article</h1>
    <p>First <a href="https://x.com/a">x ref</a> and second <a href="https://x.com/a">x ref</a>.</p>
    <p>Different <a href="https://x.com/b">b ref</a>.</p>
    <p><a href="https://x.com/c"><img src="i.png"></a></p>
  </article>`;

  it('stamps each anchor with data-srlc-id', () => {
    const r = analyzeHtml(article, 'x.com');
    expect(r.links.length).toBe(4);
    expect(r.stampedHtml).toContain('data-srlc-id="0"');
    expect(r.stampedHtml).toContain('data-srlc-id="3"');
  });

  it('extracts article title from first h1', () => {
    const r = analyzeHtml(article, 'x.com');
    expect(r.title).toBe('Test Article');
  });

  it('classifies image-only anchors as isImageLink', () => {
    const r = analyzeHtml(article, 'x.com');
    const imageLink = r.links.find((l) => l.isImageLink);
    expect(imageLink).toBeTruthy();
    expect(imageLink.anchorText).toBe('[image]');
  });

  it('groups links by normalized URL', () => {
    const r = analyzeHtml(article, 'x.com');
    expect(r.groups['/a'].links).toHaveLength(2);
    expect(r.groups['/b'].links).toHaveLength(1);
  });

  it('counts stats correctly', () => {
    const r = analyzeHtml(article, 'x.com');
    expect(r.stats.totalLinks).toBe(4);
    expect(r.stats.imageLinks).toBe(1);
    expect(r.stats.uniqueUrls).toBe(3);
  });

  it('does not run scripts from pasted HTML', () => {
    // If DOMParser executed scripts, this would throw. happy-dom honors that.
    const r = analyzeHtml('<p>safe</p><script>throw new Error("ran")</script>', '');
    expect(r.links).toEqual([]);
  });
});

describe('computeAutoStrip', () => {
  it('keeps first text occurrence and removes the rest with same anchor text', () => {
    const r = analyzeHtml(
      '<p>a <a href="/x">x ref</a> b <a href="/x">x ref</a></p>', ''
    );
    const keep = computeAutoStrip(r.links, r.groups);
    expect(keep[r.links[0].id]).toBe(true);
    expect(keep[r.links[1].id]).toBe(false);
  });

  it('keeps both when 2 text links with different anchor text', () => {
    const r = analyzeHtml(
      '<p><a href="/x">first</a> and <a href="/x">second</a></p>', ''
    );
    const keep = computeAutoStrip(r.links, r.groups);
    expect(keep[r.links[0].id]).toBe(true);
    expect(keep[r.links[1].id]).toBe(true);
  });

  it('always keeps image and cta links', () => {
    const r = analyzeHtml(
      '<p><a class="btn" href="/buy">Buy Now</a> <a href="/buy"><img src="i"></a> <a href="/buy">link 1</a> <a href="/buy">link 2</a></p>', ''
    );
    const keep = computeAutoStrip(r.links, r.groups);
    const cta = r.links.find((l) => l.isCtaLink);
    const img = r.links.find((l) => l.isImageLink);
    expect(keep[cta.id]).toBe(true);
    expect(keep[img.id]).toBe(true);
  });
});

describe('computeKeepAll', () => {
  it('marks every link as keep', () => {
    const r = analyzeHtml('<p><a href="/a">a</a><a href="/b">b</a></p>', '');
    const keep = computeKeepAll(r.links);
    r.links.forEach((l) => expect(keep[l.id]).toBe(true));
  });
});

describe('generateCleanHtml', () => {
  it('unwraps removed anchors and strips data-srlc-id from kept ones', () => {
    const r = analyzeHtml('<p>a <a href="/x">first</a> <a href="/x">second</a></p>', '');
    const keep = { [r.links[0].id]: true, [r.links[1].id]: false };
    const { html } = generateCleanHtml(r.stampedHtml, keep, r.placeholders);
    expect(html).toContain('first');
    expect(html).toContain('second');
    // Only the kept anchor should remain
    expect(html.match(/<a /g) || []).toHaveLength(1);
    expect(html).not.toContain('data-srlc-id');
  });

  it('removes target="_self" and counts it', () => {
    const r = analyzeHtml('<p><a href="/x" target="_self">x</a></p>', '');
    const keep = { [r.links[0].id]: true };
    const result = generateCleanHtml(r.stampedHtml, keep, r.placeholders);
    expect(result.targetSelfCount).toBe(1);
    expect(result.html).not.toContain('target=');
  });

  it('preserves {{ template syntax }} round-trip', () => {
    const r = analyzeHtml('<p>{{user.name}} clicked <a href="/x">here</a></p>', '');
    const keep = { [r.links[0].id]: true };
    const { html } = generateCleanHtml(r.stampedHtml, keep, r.placeholders);
    expect(html).toContain('{{user.name}}');
  });
});
