import { describe, it, expect } from 'vitest';
import { scanTags, tokenizeTag, ScannedTag } from '../../src/tagScanner';

function makeTag(overrides: Partial<ScannedTag> = {}): ScannedTag {
    return {
        name: '4DVAR', nameStart: 0, nameEnd: 0,
        expr: '', exprStart: 0, exprEnd: 0,
        tagStart: 0, tagEnd: 0,
        closed: false, multiline: false,
        ...overrides,
    };
}

// Compares tag-by-tag, property-by-property using expect.soft so every
// mismatched field is reported (with its name), instead of one failure
// aborting the assertion or a single opaque object diff.
//
// Also asserts the universal offset invariant for every actual tag: the
// recorded ranges must reproduce the recorded strings. This catches any
// drift between offsets and content even in tests that don't spell out
// every offset.
function expectTags(docText: string, actual: ScannedTag[], expected: ScannedTag[]) {
    expect.soft(actual.length, 'tags.length').toBe(expected.length);

    const count = Math.min(actual.length, expected.length);
    for (let i = 0; i < count; i++) {
        const actualTag = actual[i];
        const expectedTag = expected[i];
        for (const key of Object.keys(expectedTag) as (keyof ScannedTag)[]) {
            expect.soft(actualTag[key], `tags[${i}].${key}`).toBe(expectedTag[key]);
        }
    }

    for (let i = 0; i < actual.length; i++) {
        const tag = actual[i];
        expect.soft(docText.slice(tag.nameStart, tag.nameEnd), `tags[${i}] name range`).toBe(tag.name);
        expect.soft(docText.slice(tag.exprStart, tag.exprEnd), `tags[${i}] expr range`).toBe(tag.expr);
        expect.soft(tag.exprEnd - tag.exprStart, `tags[${i}] expr length`).toBe(tag.expr.length);
    }
}

describe('scanTags', () => {
    it('returns an empty array for text with no tags', () => {
        expect(scanTags('<html><body>hello</body></html>')).toEqual([]);
    });

    it('returns an empty array for empty text', () => {
        expect(scanTags('')).toEqual([]);
    });

    it('parses a single closed tag', () => {
        const doc = '<!--#4DVAR vNum1 -->';
        expectTags(doc, scanTags(doc), [makeTag({
            nameStart: 5,
            nameEnd: 10,
            expr: 'vNum1',
            exprStart: 11,
            exprEnd: 16,
            tagStart: 0,
            tagEnd: 20,
            closed: true,
        })]);
    });

    it('parses an unclosed tag (closed: false)', () => {
        const doc = '<!--#4DVAR vNum1';
        expectTags(doc, scanTags(doc), [makeTag({
            nameStart: 5,
            nameEnd: 10,
            expr: 'vNum1',
            exprStart: 11,
            exprEnd: 16,
            tagStart: 0,
            tagEnd: 16,
        })]);
    });

    it('parses multiple tags in one document', () => {
        const doc = '<p><!--#4DVAR vText1--></p>\n<p><!--#4DVAR vText2--></p>';
        expectTags(doc, scanTags(doc), [
            makeTag({
                nameStart: 8, nameEnd: 13,
                expr: 'vText1', exprStart: 14, exprEnd: 20,
                tagStart: 3, tagEnd: 23,
                closed: true,
            }),
            makeTag({
                nameStart: 36, nameEnd: 41,
                expr: 'vText2', exprStart: 42, exprEnd: 48,
                tagStart: 31, tagEnd: 51,
                closed: true,
            }),
        ]);
    });

    it('recovers after an unclosed tag: following tag is still scanned', () => {
        // The broken tag must end at the next "<!--" and must NOT claim the
        // later "-->" that belongs to the good tag.
        const doc = '<!--#4DVAR broken <!--#4DVAR good-->';
        expectTags(doc, scanTags(doc), [
            makeTag({
                nameStart: 5, nameEnd: 10,
                expr: 'broken', exprStart: 11, exprEnd: 17,
                tagStart: 0, tagEnd: 18,
                closed: false,
            }),
            makeTag({
                nameStart: 23, nameEnd: 28,
                expr: 'good', exprStart: 29, exprEnd: 33,
                tagStart: 18, tagEnd: 36,
                closed: true,
            }),
        ]);
    });

    it('parses a tag with an empty expression', () => {
        const doc = '<!--#4DENDLOOP-->';
        expectTags(doc, scanTags(doc), [makeTag({
            name: '4DENDLOOP',
            nameStart: 5, nameEnd: 14,
            expr: '', exprStart: 14, exprEnd: 14,
            tagStart: 0, tagEnd: 17,
            closed: true,
        })]);
    });

    it('ignores SSI directives and plain HTML comments', () => {
        expect(scanTags('<!--#include virtual="x"--><!-- note -->')).toEqual([]);
    });

    it('clamps an unclosed tag\'s expression to the opener\'s line', () => {
        const doc = '<!--#4DVAR vNa\n<div class="x">';
        expectTags(doc, scanTags(doc), [makeTag({
            nameStart: 5, nameEnd: 10,
            expr: 'vNa', exprStart: 11, exprEnd: 14,
            tagStart: 0, tagEnd: doc.length,
            closed: false,
        })]);
    });

    it('flags a closed tag spanning lines as multiline (newline in trailing whitespace)', () => {
        const doc = '<!--#4DVAR vName\n-->';
        expectTags(doc, scanTags(doc), [makeTag({
            nameStart: 5, nameEnd: 10,
            expr: 'vName', exprStart: 11, exprEnd: 16,
            tagStart: 0, tagEnd: 20,
            closed: true,
            multiline: true,
        })]);
    });

    it('parses adjacent tags on one line inside an attribute value', () => {
        // Real corpus pattern: id="am<!--#4DVAR aData4{aData1}-->"
        const doc = 'id="am<!--#4DVAR a-->x<!--#4DVAR b-->"';
        expectTags(doc, scanTags(doc), [
            makeTag({
                nameStart: 11, nameEnd: 16,
                expr: 'a', exprStart: 17, exprEnd: 18,
                tagStart: 6, tagEnd: 21,
                closed: true,
            }),
            makeTag({
                nameStart: 27, nameEnd: 32,
                expr: 'b', exprStart: 33, exprEnd: 34,
                tagStart: 22, tagEnd: 37,
                closed: true,
            }),
        ]);
    });

    it('preserves the tag name as written (lowercase not normalized)', () => {
        const doc = '<!--#4dvar vX-->';
        expectTags(doc, scanTags(doc), [makeTag({
            name: '4dvar',
            nameStart: 5, nameEnd: 10,
            expr: 'vX', exprStart: 11, exprEnd: 13,
            tagStart: 0, tagEnd: 16,
            closed: true,
        })]);
    });

    it('captures unknown 4D-prefixed names for the diagnostics layer', () => {
        const doc = '<!--#4DVARR vX-->';
        expectTags(doc, scanTags(doc), [makeTag({
            name: '4DVARR',
            nameStart: 5, nameEnd: 11,
            expr: 'vX', exprStart: 12, exprEnd: 14,
            tagStart: 0, tagEnd: 17,
            closed: true,
        })]);
    });

    it('parses array-subscript expressions verbatim', () => {
        const doc = '<td><!--#4DVAR aData1{aData1}--></td>';
        expectTags(doc, scanTags(doc), [makeTag({
            nameStart: 9, nameEnd: 14,
            expr: 'aData1{aData1}', exprStart: 15, exprEnd: 29,
            tagStart: 4, tagEnd: 32,
            closed: true,
        })]);
    });
});

describe('tokenizeTag', () => {
    it('returns an empty array (stub implementation)', () => {
        expect(tokenizeTag('irrelevant text', makeTag())).toEqual([]);
    });
});
