'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require(require.resolve('acorn', { paths: [__dirname, path.join(__dirname, '..', 'ZoeW')] }));
const { auditModuleSourceRanges } = require('./react-view');

// Generated app.js is a non-executed source inventory, not a single lexical script.
// Validate its exact module views before parsing, keep each Program scope separate,
// and preserve original offsets so source extraction and paired mutation checks agree.
function modulePrograms(source, filename, options = {}) {
    const directory = path.dirname(filename);
    const parts = path.basename(filename) === 'app.js' && fs.existsSync(path.join(directory, 'audit-module-views.json'))
        ? auditModuleSourceRanges(directory, source)
        : [{ source, start: 0, end: source.length }];
    return parts.map(part => {
        const prefix = source.slice(0, part.start);
        const lineOffset = (prefix.match(/\n/g) || []).length;
        const columnOffset = prefix.length - prefix.lastIndexOf('\n') - 1;
        const comments = options.onComment ? [] : null;
        const ast = acorn.parse(part.source, comments ? { ...options, onComment: comments } : options);
        const shiftedNodes = new WeakSet();
        const shiftedPositions = new WeakSet();
        const shift = value => {
            if (!value || typeof value !== 'object' || shiftedNodes.has(value)) return;
            shiftedNodes.add(value);
            if (Array.isArray(value)) { value.forEach(shift); return; }
            if (typeof value.type === 'string') {
                if (Number.isInteger(value.start)) value.start += part.start;
                if (Number.isInteger(value.end)) value.end += part.start;
                if (Array.isArray(value.range)) value.range = value.range.map(offset => offset + part.start);
                if (value.loc) {
                    for (const edge of ['start', 'end']) {
                        if (shiftedPositions.has(value.loc[edge])) continue;
                        shiftedPositions.add(value.loc[edge]);
                        if (value.loc[edge].line === 1) value.loc[edge].column += columnOffset;
                        value.loc[edge].line += lineOffset;
                    }
                }
            }
            for (const [key, child] of Object.entries(value)) if (!['loc', 'range'].includes(key)) shift(child);
        };
        shift(ast);
        if (comments) for (const comment of comments) {
            shift(comment);
            if (Array.isArray(options.onComment)) options.onComment.push(comment);
            else options.onComment(comment.type === 'Block', comment.value, comment.start, comment.end, comment.loc?.start, comment.loc?.end);
        }
        return ast;
    });
}

module.exports = { modulePrograms };
