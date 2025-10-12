export function keyDiscountNodes(telegramId: string): string {
    return `discount:nodes:${telegramId}`;
}

export function keyDiscountAccount(telegramId: string): string {
    return `discount:accounts:${telegramId}`;
}
