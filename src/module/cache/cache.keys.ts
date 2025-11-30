export const getCouponPageKey = (page: string | number) => {
    return `bott:getCouponPage:${page}`;
};

export const getSearchIdKey = (telegramId: string) => `bott:searchIdByTelegramId:${telegramId}`;

export const getUserBotIdKey = (searchId: string) => `bott:getUserBotId:${searchId}`;

export const getStatisticsKey = () => `bott:getStatistics`;
