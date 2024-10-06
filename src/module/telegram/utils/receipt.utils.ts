import dayjs from 'dayjs';

export const getFileNameForReceipt = (telegramId: string, extension: string) => {
    const day = dayjs().format('YYYY-MM-DD_HH-mm');
    return `receipt_${telegramId}_${day}.${extension}`;
};
