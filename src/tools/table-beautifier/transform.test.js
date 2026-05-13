import { describe, it, expect } from 'vitest';
import { beautifyTable } from './transform';

describe('beautifyTable', () => {
  it('extracts thead headers and styles rows', () => {
    const html = `<table>
      <thead><tr><th>A</th><th>B</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>2</td></tr>
        <tr><td>3</td><td>4</td></tr>
      </tbody>
    </table>`;
    const out = beautifyTable(html);
    expect(out).toContain('<th style="');
    expect(out).toContain('>A<');
    expect(out).toContain('>1<');
    expect(out).toMatch(/background: #252525/);
    expect(out).toMatch(/background: #1e1e1e/);
  });

  it('falls back to first row when no thead present', () => {
    const html = `<table>
      <tr><td>Col1</td><td>Col2</td></tr>
      <tr><td>v1</td><td>v2</td></tr>
    </table>`;
    const out = beautifyTable(html);
    expect(out).toContain('>Col1<');
    expect(out).toContain('>v1<');
  });

  it('preserves inner HTML in cells', () => {
    const html = `<table><tr><th>X</th></tr><tr><td><a href="/x">link</a></td></tr></table>`;
    const out = beautifyTable(html);
    expect(out).toContain('<a href="/x">link</a>');
  });

  it('throws when no <table> present', () => {
    expect(() => beautifyTable('<p>nope</p>')).toThrow();
  });
});
