export function elapsedSince(mark) {
    if (!mark) return Infinity;
    const delta = Date.now() - mark;
    return delta >= 0 ? delta : Infinity;
}
