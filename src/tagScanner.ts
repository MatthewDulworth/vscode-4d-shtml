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
// Token group names MUST match every (and only) name in TokenKind
const TOKEN = /(?<string>"[^"]*")|(?<operator><=|>=|[=#<>])|(?<number>\d+(?:\.\d+)?)|(?<brace>[{}])|(?<paren>[()])|(?<variable>[A-Za-z_][A-Za-z0-9_]*)/g;
const NONE = -1;

export function scanTags(docText: string): ScannedTag[] {

    let match: RegExpExecArray | null;
    const tags: ScannedTag[] = [];

    OPENER.lastIndex = 0;

    while ((match = OPENER.exec(docText)) !== null) {

        let nameStart = 0;
        let nameEnd = 0;

        if (match.indices && match.indices[1]) {
            const indices = match.indices[1];
            nameStart = indices[0];
            nameEnd = indices[1];
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
        let rawExpr = "";

        // If there is a close tag that closes before the next tag or html comment open
        if ((close !== NONE) && (nextOpen === NONE || close < nextOpen)) {
            tag.closed = true;
            tag.tagEnd = close + 3;

            rawExpr = docText.slice(tag.nameEnd, close);
            tag.multiline = rawExpr.indexOf("\n") !== NONE;
        } else  {
            tag.tagEnd = (nextOpen !== NONE) ? nextOpen : docText.length;

            const lineEnd = docText. indexOf("\n", tag.nameEnd);
            const exprLimit = Math.min(
                tag.tagEnd,
                lineEnd === NONE ? docText.length : lineEnd
            );

            rawExpr = docText.slice(tag.nameEnd, exprLimit);
        }

        const leading = rawExpr.length - rawExpr.trimStart().length;
        tag.expr = rawExpr.trim();
        tag.exprStart = tag.nameEnd + leading;
        tag.exprEnd = tag.exprStart + tag.expr.length;

        tags.push(tag);
        OPENER.lastIndex = tag.tagEnd;
    }

    return tags;
}

export function tokenizeTag(docText: string, tag: ScannedTag): ExprToken[] {
    const tokens: ExprToken[] = [];

    tokens.push({
        kind: 'delimiter',
        start: tag.tagStart, 
        end: tag.tagStart + 5,
    });

    tokens.push({
        kind: 'tagName',
        start: tag.nameStart,
        end: tag.nameEnd,
    });

    for (const match of tag.expr.matchAll(TOKEN)) {
        // Confirm groups defined
        const groups = match.groups ?? {}; 
        // Get the names of all the groups
        const groupNames = Object.keys(groups); 
        // Find the group name that isn't undefined
        const kind = groupNames.find(name => groups[name] !== undefined) as TokenKind;

        tokens.push({
            kind: kind,
            start: tag.exprStart + match.index,
            end: tag.exprStart + match.index + match[0].length,
        });
    }

    if (tag.closed) {
        tokens.push({
            kind: 'delimiter',
            start: tag.tagEnd - 3,
            end: tag.tagEnd,
        });
    }

    return tokens;
}