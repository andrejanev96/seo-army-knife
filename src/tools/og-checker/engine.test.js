import { describe, it, expect } from 'vitest';
import {
  parseMetaTags,
  detectIssues,
  generateMetaTagsCode,
  getDomain,
  lengthStatus,
  TITLE_LENGTH,
  DESC_LENGTH,
} from './engine';

const sampleHtml = `<!doctype html>
<html>
  <head>
    <title>Example Page Title</title>
    <meta name="description" content="An example description that is long enough to be useful but not too long to be cropped.">
    <link rel="canonical" href="https://example.com/page">
    <link rel="icon" href="/favicon.ico">
    <meta property="og:title" content="Example OG Title">
    <meta property="og:description" content="An example description that is long enough to be useful but not too long to be cropped.">
    <meta property="og:image" content="https://example.com/image.png">
    <meta property="og:url" content="https://example.com/page">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Example Twitter Title">
  </head>
  <body>body</body>
</html>`;

describe('parseMetaTags', () => {
  it('extracts core, og, and twitter metadata', () => {
    const meta = parseMetaTags(sampleHtml, 'https://example.com/page');
    expect(meta.title).toBe('Example Page Title');
    expect(meta.og.title).toBe('Example OG Title');
    expect(meta.og.image).toBe('https://example.com/image.png');
    expect(meta.twitter.card).toBe('summary_large_image');
    expect(meta.canonical).toBe('https://example.com/page');
    expect(meta.favicon).toBe('https://example.com/favicon.ico');
  });

  it('resolves relative og:image against base URL', () => {
    const html = '<html><head><meta property="og:image" content="/img.png"></head></html>';
    const meta = parseMetaTags(html, 'https://x.com/article');
    expect(meta.og.image).toBe('https://x.com/img.png');
  });

  it('returns empty strings for missing tags rather than null', () => {
    const meta = parseMetaTags('<html></html>', 'https://x.com');
    expect(meta.og.title).toBe('');
    expect(meta.twitter.card).toBe('');
  });
});

describe('detectIssues', () => {
  it('flags missing og:title/description/image as errors', () => {
    const meta = parseMetaTags('<html></html>', 'https://x.com');
    const issues = detectIssues(meta);
    const errors = issues.filter((i) => i.severity === 'error').map((i) => i.message);
    expect(errors).toContain('Missing og:title');
    expect(errors).toContain('Missing og:description');
    expect(errors).toContain('Missing og:image');
  });

  it('warns on title length outside ideal range but inside ok range', () => {
    const html = `<html><head>
      <meta property="og:title" content="${'x'.repeat(40)}">
      <meta property="og:description" content="${'y'.repeat(120)}">
      <meta property="og:image" content="https://e.com/i.png">
    </head></html>`;
    const meta = parseMetaTags(html, 'https://x.com');
    const issues = detectIssues(meta);
    const warning = issues.find((i) => i.severity === 'warning' && i.message.includes('og:title'));
    expect(warning).toBeTruthy();
    expect(warning.message).toMatch(/ideal/);
  });

  it('flags title shorter than minOk as error', () => {
    const html = `<html><head>
      <meta property="og:title" content="short">
      <meta property="og:description" content="${'y'.repeat(120)}">
      <meta property="og:image" content="https://e.com/i.png">
    </head></html>`;
    const meta = parseMetaTags(html, 'https://x.com');
    const issues = detectIssues(meta);
    const error = issues.find((i) => i.severity === 'error' && i.message.includes('og:title'));
    expect(error).toBeTruthy();
  });

  it('warns on http:// image URLs', () => {
    const meta = {
      og: { title: 'a'.repeat(55), description: 'b'.repeat(130), image: 'http://x.com/i.png', url: '', type: '', siteName: '' },
      twitter: { card: '', title: '', description: '', image: '', domain: '', site: '' },
      title: '', description: '', canonical: '', favicon: '',
    };
    const issues = detectIssues(meta);
    expect(issues.some((i) => i.message.includes('HTTP'))).toBe(true);
  });
});

describe('lengthStatus', () => {
  it('returns empty/ok/warning/error for title boundaries', () => {
    expect(lengthStatus(0, TITLE_LENGTH)).toBe('empty');
    expect(lengthStatus(55, TITLE_LENGTH)).toBe('ok');
    expect(lengthStatus(40, TITLE_LENGTH)).toBe('warning');
    expect(lengthStatus(100, TITLE_LENGTH)).toBe('error');
    expect(lengthStatus(10, TITLE_LENGTH)).toBe('error');
  });

  it('returns same states for description thresholds', () => {
    expect(lengthStatus(0, DESC_LENGTH)).toBe('empty');
    expect(lengthStatus(130, DESC_LENGTH)).toBe('ok');
    expect(lengthStatus(80, DESC_LENGTH)).toBe('warning');
    expect(lengthStatus(250, DESC_LENGTH)).toBe('error');
  });
});

describe('generateMetaTagsCode', () => {
  it('emits HTML / OG / Twitter sections', () => {
    const meta = parseMetaTags(sampleHtml, 'https://example.com/page');
    const code = generateMetaTagsCode(meta);
    expect(code).toContain('<!-- HTML Meta Tags -->');
    expect(code).toContain('<!-- Open Graph / Facebook -->');
    expect(code).toContain('<!-- Twitter -->');
    expect(code).toContain('og:title');
    expect(code).toContain('twitter:card');
  });

  it('escapes HTML special chars in content attrs', () => {
    const meta = {
      title: 'a & b <c> "d"',
      description: '', canonical: '', favicon: '',
      og: { title: '', description: '', image: '', url: '', type: '', siteName: '' },
      twitter: { card: '', title: '', description: '', image: '', domain: '', site: '' },
    };
    const code = generateMetaTagsCode(meta);
    expect(code).toContain('&amp;');
    expect(code).toContain('&lt;');
    expect(code).toContain('&quot;');
  });
});

describe('getDomain', () => {
  it('strips www. prefix', () => {
    expect(getDomain('https://www.example.com/path')).toBe('example.com');
  });

  it('returns input verbatim when not a URL', () => {
    expect(getDomain('not a url')).toBe('not a url');
  });
});
