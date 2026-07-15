export interface ScannedTag {
    name: string;       // as written: "4DVAR", "4dvar", "4DVARR"
    nameStart: number; 
    nameEnd: number;    // offsets into document text

    expr: string; 
    exprStart: number; 
    exprEnd: number;    // trimmed

    tagStart: number; 
    tagEnd: number;

    closed: boolean; 
    multiline: boolean;
}

export type TokenKind = 'delimiter'|'tagName'|'variable'|'operator'|'number'|'string'|'brace'|'paren';
export interface ExprToken { kind: TokenKind; start: number; end: number; }
const OPENER = /<!--#(4[Dd][A-Za-z0-9_]*)/gd;
const NONE = -1;

export function scanTags(docText: string): ScannedTag[] {

    let match: RegExpExecArray | null;
    const tags: ScannedTag[] = [];

    OPENER.lastIndex = 0;

    while ((match = OPENER.exec(docText)) !== null) {

        let nameStart = 0;
        let nameEnd = 0;

        if (match.indices && match.indices[1]) {
            const indicies = match.indices[1];
            nameStart = indicies[0];
            nameEnd = indicies[1];
        }

        const tag: ScannedTag = {
            name: match[1],
            nameStart: nameStart,
            nameEnd: nameEnd,

            expr: "",
            exprStart: 0,
            exprEnd: 0,

            tagStart: match.index,
            tagEnd: 0,

            closed: false,
            multiline: false,
        };

        const openEnd = match.index + match[0].length;
        const close = docText.indexOf("-->", openEnd);
        const nextOpen = docText.indexOf("<!--", openEnd);

        // If there is a close tag that closes before the next tag or html comment open
        if ((close !== NONE) && (nextOpen === NONE || close < nextOpen)) {
            tag.closed = true;
            tag.tagEnd = close + 3;

            const raw = docText.slice(tag.nameEnd, close);
            const leading = raw.length - raw.trimStart().length;
            tag.expr = raw.trim();
            tag.exprStart = tag.nameEnd + leading;
            tag.exprEnd = tag.exprStart + tag.expr.length;

            tag.multiline = raw.indexOf("\n") !== NONE;
        } else if (nextOpen !== NONE) {
            tag.tagEnd = nextOpen;
        } else {
            tag.tagEnd = docText.length;
        } 

        tags.push(tag);
        OPENER.lastIndex = tag.tagEnd;
    }

    return tags;
}

export function tokenizeTag(text: string, tag: ScannedTag): ExprToken[] {
    return [];
}