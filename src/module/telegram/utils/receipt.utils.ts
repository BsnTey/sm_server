import { WizardContext } from 'telegraf/typings/scenes';
import dayjs from 'dayjs';

export const getFileNameReceipt = async (ctx: WizardContext) => {
    const telegramId = ctx!.from!.id;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    const photos = ctx!.message!.photo;
    const fileId = photos[photos.length - 2].file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

    const fileExtension = fileLink.href.split('.').pop() || 'jpg';
    const day = dayjs().format('YYYY-MM-DD_HH-mm');

    return {
        fileName: `receipt_${telegramId}_${day}.${fileExtension}`,
        fileLink,
    };
};
