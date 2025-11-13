export function extractPercentFromNode(node: string | null): number {
    if (!node) return 0;

    const matches = node.match(/(\d+)\s*%/g);
    if (!matches) return 0;

    const nums = matches
        .map(m => {
            const n = parseInt(m, 10);
            return Number.isFinite(n) ? n : NaN;
        })
        .filter(n => Number.isFinite(n)) as number[];

    if (!nums.length) return 0;

    return Math.min(...nums);
}
