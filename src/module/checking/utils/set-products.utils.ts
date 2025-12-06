import { PreparedAccountInfo } from '../interfaces/extend-chrome.interface';

const PAGE_MICRO_DELAY_MS = 1000; // микро-пауза между страницами (с джиттером)
const RETRY_MAX_ATTEMPTS = 5;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const jitter = (ms: number, spread = 0.35) => {
    const d = ms * spread;
    return Math.max(0, ms - d + Math.random() * (2 * d));
};

export async function requestWithBackoff<T>(doRequest: () => Promise<T>, maxAttempts = RETRY_MAX_ATTEMPTS): Promise<T> {
    let attempt = 1;
    while (true) {
        try {
            const res = await doRequest();
            // лёгкая пауза между страницами, чтобы «человечнее» выглядеть
            await sleep(jitter(PAGE_MICRO_DELAY_MS));
            return res;
        } catch (e: any) {
            const status = e?.response?.status ?? e?.statusCode;
            // ретраем только 429 и 5xx
            const retryable = status === 429 || (typeof status === 'number' && status >= 500);
            if (!retryable || attempt >= maxAttempts) throw e;
            const backoff = Math.min(2000 * 2 ** (attempt - 1), 15000);
            await sleep(jitter(backoff, 0.4));
            attempt++;
        }
    }
}

export function* chunk<T>(arr: T[], size: number): Generator<T[]> {
    for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

// начало следующего дня в UTC: безопасная «эксклюзивная граница»
export function startOfNextDayUTC(dateStrYYYYMMDD: string): Date {
    const [y, m, d] = dateStrYYYYMMDD.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
}

// сортировка: (<2 orders) первыми, затем по bonus ↓, затем по orders ↑
export function cmp(a: PreparedAccountInfo, b: PreparedAccountInfo) {
    const ap = a.ordersNumber >= 2 ? 1 : 0;
    const bp = b.ordersNumber >= 2 ? 1 : 0;
    if (ap !== bp) return ap - bp;
    if (b.bonus !== a.bonus) return b.bonus - a.bonus;
    if (a.ordersNumber !== b.ordersNumber) return a.ordersNumber - b.ordersNumber;
    return a.accountId.localeCompare(b.accountId);
}
