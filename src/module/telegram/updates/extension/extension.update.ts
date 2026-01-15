import { Action, Ctx, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { NotFoundException, UseFilters } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { ERROR_ACCESS, ERROR_FOUND_USER } from '../../constants/error.constant';
import { extensionVersion } from '@common/constants/extension';
import { EXTENSION_SCENE } from '../../scenes/profile.scene-constant';
import { downloadExtension } from '../../keyboards/profile.keyboard';
import { UserRole } from '@prisma/client';
import { BaseUpdate } from '../base/base.update';

interface ContextWithMatch extends WizardContext {
    match: RegExpExecArray;
}

@Scene(EXTENSION_SCENE)
@UseFilters(TelegrafExceptionFilter)
export class ExtensionUpdate extends BaseUpdate {
    constructor() {
        super();
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);

        if (!([UserRole.Seller, UserRole.Admin] as string[]).includes(user.role)) {
            throw new NotFoundException(ERROR_ACCESS);
        }

        const dirPath = path.join(process.cwd(), 'files');

        let text = '';
        let keyboard: any = undefined;

        if (!fs.existsSync(dirPath)) {
            text = 'Папка с файлами не найдена. Обратитесь к администратору.';
        } else {
            const files = fs
                .readdirSync(dirPath)
                .filter(file => file.endsWith('.zip'))
                .sort()
                .reverse();

            if (files.length === 0) {
                text = 'Файлы для скачивания отсутствуют.';
            } else {
                text = `Актуальная версия: ${extensionVersion.latestVersion}\n\nВыберите файл для скачивания:`;
                keyboard = downloadExtension(files);
            }
        }

        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, keyboard);
            await ctx.answerCbQuery();
        } else {
            await ctx.reply(text, keyboard);
        }
    }

    @Action(/^dl_ext:(.+)$/)
    async onDownloadZip(@Ctx() ctx: ContextWithMatch) {
        const requestedFile = ctx.match[1];

        const safeFilename = path.basename(requestedFile);

        const filePath = path.join(process.cwd(), 'files', safeFilename);

        if (!fs.existsSync(filePath)) {
            await ctx.answerCbQuery('Файл не найден ❌');
            return;
        }

        try {
            await ctx.answerCbQuery();
            await ctx.replyWithDocument({
                source: filePath,
                filename: safeFilename,
            });
        } catch {
            await ctx.reply('Произошла ошибка при отправке файла.');
        }
    }
}
