import { Ctx, Hears, Message, On, Scene, SceneEnter, Sender } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { ADMIN, ALL_KEYS_MENU_BUTTON_NAME } from '../base-command/base-command.constants';
import { TelegramService } from '../../telegram.service';
import { NotFoundException, UseFilters, UseGuards } from '@nestjs/common';
import { TelegrafExceptionFilter } from '../../filters/telegraf-exception.filter';
import { createWriteStream, promises as fsPromises } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { AccountService } from '../../../account/account.service';
import { AdminGuard } from './admin.guard';
import { ERROR_FOUND_USER } from '../../constants/error.constant';
import { getMainMenuKeyboard } from '../../keyboards/base.keyboard';
import { BaseUpdate } from '../base/base.update';

@Scene(ADMIN.scene)
@UseFilters(TelegrafExceptionFilter)
export class AdminUpdate extends BaseUpdate {
    constructor(private accountService: AccountService) {
        super();
    }

    @SceneEnter()
    @UseGuards(AdminGuard)
    async onSceneEnter(@Ctx() ctx: WizardContext, @Sender() { id: telegramId }: any) {
        const user = await this.userService.getUserByTelegramId(String(telegramId));
        if (!user?.role) throw new NotFoundException(ERROR_FOUND_USER);
        await ctx.reply('Пришли текстовый файл', getMainMenuKeyboard(user.role));
    }

    @Hears(ALL_KEYS_MENU_BUTTON_NAME)
    async exit(@Message('text') menuBtn: string, @Ctx() ctx: WizardContext) {
        await this.exitScene(menuBtn, ctx);
    }

    @On('document')
    // @UseGuards(AdminGuard)
    async onDocument(@Message('document') document: any, @Ctx() ctx: WizardContext) {
        const fileId = document.file_id;
        const fileUrl = await ctx.telegram.getFileLink(fileId);
        const filePath = join(process.cwd(), 'downloads', `${document.file_name}`);

        await this.downloadFile(fileUrl.href, filePath);
        const fileContent = await fsPromises.readFile(filePath, 'utf-8');

        const accounts = this.parseFileContent(fileContent);
        await this.addAccounts(accounts);
        await ctx.reply('Аккаунты добавлены');
    }

    private async downloadFile(fileUrl: string, filePath: string): Promise<void> {
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream',
        });

        await new Promise((resolve, reject) => {
            const stream = createWriteStream(filePath);
            response.data.pipe(stream);
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }

    private parseFileContent(fileContent: string): string[][] {
        return fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.split('\t'));
    }

    private async addAccounts(accounts: any[][]) {
        for (const account of accounts) {
            let xUserId = account[7];
            if (xUserId.charAt(0) === 'A') {
                xUserId = xUserId.substring(1);
            }
            await this.accountService.addingAccount({
                accountId: account[0],
                email: account[1],
                passImap: account[2],
                passEmail: account[3],
                cookie: account[4],
                accessToken: account[5],
                refreshToken: account[6],
                xUserId,
                deviceId: account[8],
                installationId: account[9],
                expiresIn: '0',
                bonusCount: '0',
                isOnlyAccessOrder: account[10],
                accessTokenCourse: undefined,
                refreshTokenCourse: undefined,
            });
        }
    }
}
