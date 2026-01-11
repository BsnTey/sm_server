export const getCouponPageKey = (page: string | number) => {
    return `bott:getCouponPage:${page}`;
};

export const getSearchIdKey = (telegramId: string) => `bott:searchIdByTelegramId:${telegramId}`;

export const getUserBotIdKey = (searchId: string) => `bott:getUserBotId:${searchId}`;

export const getStatisticsKey = () => `bott:getStatistics`;

export const getUserByTelegramIdKey = (telegramId: string) => `user:getUserByTelegramId:${telegramId}`;
export const getPrefsUserByTelegramIdKey = (telegramId: string) => `user:setNotificationPrefs:${telegramId}`;
export const getAccountEntityKey = (accountId: string) => `acc:entity:${accountId}`;
export const getAnonymAccountEntityKey = () => `acc:anonymEntity`;
export const getShortInfoKey = (accountId: string) => `acc:shortInfo:${accountId}`;
export const getAccessTokenCouresKey = (accountId: string) => `acc:accessTokenCourse:${accountId}`;
export const getOrdersTodayKey = (accountId: string) => `orders_today:${accountId}`;

// Discount-related cache key prefixes
export const CACHE_PREFIX_DISCOUNT = 'discount:';
export const CACHE_PREFIX_ACCOUNT = 'acc:';

export const DISCOUNT_CACHE_PREFIXES = [
    CACHE_PREFIX_DISCOUNT,
    CACHE_PREFIX_ACCOUNT,
] as const;

