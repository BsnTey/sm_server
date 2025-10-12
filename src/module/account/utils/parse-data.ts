export function toEndOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function parseDateFlexible(input: string): Date {
    if (!input) return new Date(NaN);

    // YYYY-MM-DD — без времени: выставляем конец дня
    const ymd = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
        const [, yyyy, mm, dd] = ymd;
        return toEndOfDay(new Date(Number(yyyy), Number(mm) - 1, Number(dd)));
    }

    // DD.MM.YYYY — без времени: конец дня
    const dmy = input.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dmy) {
        const [, dd, mm, yyyy] = dmy;
        return toEndOfDay(new Date(Number(yyyy), Number(mm) - 1, Number(dd)));
    }

    // ISO/с временем — используем как есть
    const dt = new Date(input);
    if (!isNaN(dt.getTime())) return dt;

    return new Date(NaN);
}
