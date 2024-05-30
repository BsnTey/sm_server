import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Ctx } from 'nestjs-telegraf';
import { WizardContext } from 'telegraf/typings/scenes';
import { getValueKeysMenu } from './updates/base-command/base-command.constants';
import { IAccountCashing } from '../account/interfaces/account.interface';
import { ERROR_TIMEOUT_TTL_CASH } from './constants/error.constant';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
    private TTL_CASH = this.configService.getOrThrow('TTL_CASH', 86000000);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private configService: ConfigService,
    ) {}

    async exitScene(menuBtn: string, @Ctx() ctx: WizardContext) {
        await ctx.scene.leave();
        const scene = getValueKeysMenu(menuBtn);
        if (scene) {
            return await ctx.scene.enter(scene);
        }
    }

    async setTelegramAccountCache(telegramId: number, accountId: string) {
        const accountFromCache = await this.cacheManager.get<IAccountCashing>(String(telegramId));
        if (accountFromCache) {
            await this.cacheManager.del(accountFromCache.accountId);
        }
        await this.cacheManager.del(accountId);
        await this.cacheManager.set(String(telegramId), { accountId }, this.TTL_CASH);
    }

    async getFromCache(telegramId: number) {
        const account = await this.cacheManager.get<IAccountCashing>(String(telegramId));
        if (!account) throw new HttpException(ERROR_TIMEOUT_TTL_CASH, HttpStatus.FORBIDDEN);
        return account;
    }

    async setDataCache(telegramId: number, data: any[]) {
        const dataFromCache = await this.cacheManager.get<any>(String(telegramId));
        if (dataFromCache) {
            await this.cacheManager.del(dataFromCache.data);
        }
        await this.cacheManager.set(String(telegramId), data, this.TTL_CASH);
    }

    async getDataFromCache(telegramId: number): Promise<any[]> {
        const data = await this.cacheManager.get<any>(String(telegramId));
        if (!data) throw new HttpException(ERROR_TIMEOUT_TTL_CASH, HttpStatus.FORBIDDEN);
        return data;
    }
}
