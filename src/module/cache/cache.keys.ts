export const getCouponPageKey = (page: string | number) => {
    return `bott:getCouponPage:${page}`;
};

export const getSearchIdKey = (telegramId: string) => `bott:searchIdByTelegramId:${telegramId}`;

export const getUserBotIdKey = (searchId: string) => `bott:getUserBotId:${searchId}`;

export const getStatisticsKey = () => `bott:getStatistics`;

export const getUserByTelegramIdKey = (telegramId: string) => `user:getUserByTelegramId:${telegramId}`;
export const getPrefsUserByTelegramIdKey = (telegramId: string) => `user:setNotificationPrefs:${telegramId}`;
export const getAccountEntityKey = (accountId: string) => `acc:entity:${accountId}`;
export const getOrdersTodayKey = (accountId: string) => `orders_today:${accountId}`;
