import { Ctx } from 'nestjs-telegraf';
import { getValueKeysMenu } from '../base-command/base-command.constants';
import { WizardContext } from 'telegraf/typings/scenes';
import { UserService } from '../../../user/user.service';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../../../cache/cache.service';

export class BaseUpdate {
    @Inject(UserService)
    protected userService!: UserService;

    @Inject(ConfigService)
    protected configService: ConfigService;

    @Inject(RedisCacheService)
    protected cacheService: RedisCacheService;

    async createOrUpdateUserTelegram(telegramName: string, telegramId: number | string) {
        return this.userService.createOrUpdateUserByTelegram({
            telegramName,
            telegramId: String(telegramId),
        });
    }

    async exitScene(menuBtn: string, @Ctx() ctx: WizardContext) {
        await ctx.scene.leave();
        const scene = getValueKeysMenu(menuBtn);
        if (scene) {
            return await ctx.scene.enter(scene);
        }
    }
}
