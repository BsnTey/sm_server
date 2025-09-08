import { gzip, ungzip } from 'pako';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
function pruneNulls(value: any, { compactArrays = true, dropUndefined = true } = {}) {
    if (value === null) return null;
    if (Array.isArray(value)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const mapped = value.map(v => pruneNulls(v, { compactArrays, dropUndefined }));
        return compactArrays ? mapped.filter((v: null | undefined) => v !== null && v !== undefined) : mapped;
    }
    if (value && typeof value === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(value)) {
            if (v === null) continue;
            if (dropUndefined && typeof v === 'undefined') continue;
            out[k] = pruneNulls(v, { compactArrays, dropUndefined });
        }
        return out;
    }
    return value;
}

const toBase64 = (u8: Uint8Array) =>
    typeof Buffer !== 'undefined' ? Buffer.from(u8).toString('base64') : btoa(String.fromCharCode(...(u8 as any)));

const fromBase64 = (b64: string) =>
    typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(b64, 'base64')) : Uint8Array.from(atob(b64), c => c.charCodeAt(0));

export function encodeXlocation(input: unknown): string {
    const json = JSON.stringify(pruneNulls(input));
    const gz = gzip(json, {
        level: 6,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        mtime: 0,
        header: { os: 0, xflags: 0 },
    });
    return toBase64(gz);
}

export function decodeXlocation(b64: string): string {
    const raw = fromBase64(b64);
    return new TextDecoder().decode(ungzip(raw));
}
