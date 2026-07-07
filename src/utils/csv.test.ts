import { parseCsv, buildCsv } from './csv';

describe('csv — parseCsv', () => {
  it('parses a simple grid', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    expect(parseCsv('name,qty\n"White shirt, cotton",5')).toEqual([
      ['name', 'qty'],
      ['White shirt, cotton', '5'],
    ]);
  });

  it('handles "" escaped quotes inside quoted fields', () => {
    expect(parseCsv('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
  });

  it('handles newlines inside quoted fields', () => {
    expect(parseCsv('note\n"line1\nline2"')).toEqual([['note'], ['line1\nline2']]);
  });

  it('tolerates CRLF and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips a leading UTF-8 BOM', () => {
    expect(parseCsv('﻿name\nx')).toEqual([['name'], ['x']]);
  });

  it('keeps empty trailing cells', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });
});

describe('csv — buildCsv round-trips', () => {
  it('quotes only cells that need it and reparses identically', () => {
    const rows = [
      ['name', 'note'],
      ['Plain', 'has, comma'],
      ['Quote "x"', 'line\nbreak'],
    ];
    expect(parseCsv(buildCsv(rows))).toEqual(rows);
  });
});
