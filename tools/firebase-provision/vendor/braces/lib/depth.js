'use strict';

const MAX_DEPTH = 100;

const rejectDepth = () => {
  const error = new RangeError(`Brace nesting exceeds maximum depth (${MAX_DEPTH})`);
  error.code = 'BRACES_MAX_DEPTH';
  throw error;
};

const assertDepth = ast => {
  const active = new Set();
  const stack = [{ node: ast, depth: 0, exit: false }];
  while (stack.length) {
    const frame = stack.pop();
    const node = frame.node;
    if (!node || !Array.isArray(node.nodes)) continue;
    if (frame.exit) {
      active.delete(node);
      continue;
    }
    if (frame.depth > MAX_DEPTH || active.has(node)) rejectDepth();
    active.add(node);
    stack.push({ node, depth: frame.depth, exit: true });
    for (let i = node.nodes.length - 1; i >= 0; i--) {
      stack.push({ node: node.nodes[i], depth: frame.depth + 1, exit: false });
    }
  }
};

module.exports = { MAX_DEPTH, rejectDepth, assertDepth };
