import { BadRequestException, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AccountMirror } from '@prisma/client';
import { AccountService } from '../account/account.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MirrorRepository } from './mirror.repository';

interface JwtPayload {
    smid: string;
    ip: string;
    exp: number;
}

@Injectable()
export class MirrorService {
    private botToken = this.configService.getOrThrow('TELEGRAM_BOT_TOKEN');
    private domain = this.configService.getOrThrow('DOMAIN').split('://')[1];
    constructor(
        private readonly mirrorRepository: MirrorRepository,
        private readonly accountService: AccountService,
        private readonly jwtService: JwtService,
        private configService: ConfigService,
    ) {}

    async createAccountMirror(telegramId: string, telegramName: string): Promise<AccountMirror> {
        return this.mirrorRepository.createAccountMirror(telegramId, telegramName);
    }

    async updateAccountMirror(id: string, data: Partial<AccountMirror>): Promise<AccountMirror | null> {
        return this.mirrorRepository.updateAccountMirror(id, data);
    }

    async findAccountMirrorByMirrorToken(mirrorToken: string): Promise<AccountMirror | null> {
        return this.mirrorRepository.findAccountMirrorByMirrorToken(mirrorToken);
    }

    async generateMirrorToken(id: string): Promise<{ mirrorToken: string; mirrorTokenExpiry: Date }> {
        const mirrorToken = uuidv4();
        const mirrorTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await this.updateAccountMirror(id, { mirrorToken, mirrorTokenExpiry });
        return { mirrorToken, mirrorTokenExpiry };
    }

    async validateMirrorToken(mirrorToken: string): Promise<AccountMirror> {
        const mirrorEntry = await this.findAccountMirrorByMirrorToken(mirrorToken);
        if (!mirrorEntry || !mirrorEntry.accountId) {
            throw new BadRequestException('Неверный токен');
        }
        if (!mirrorEntry.mirrorTokenExpiry || mirrorEntry.mirrorTokenExpiry < new Date()) {
            throw new BadRequestException('Время действия ссылки истекло');
        }
        return mirrorEntry;
    }

    async createJwt(
        mirrorEntry: AccountMirror,
        ipAddress: string,
    ): Promise<{ jwtToken: string; smid: string; domain: string; expiry: Date }> {
        if (!mirrorEntry.accountId) {
            throw new BadRequestException('Нет id');
        }

        if (!mirrorEntry.mirrorTokenExpiry) {
            throw new BadRequestException('Нет токена');
        }

        const accountEntity = await this.accountService.getAccount(mirrorEntry.accountId);
        const cookies: any[] = JSON.parse(accountEntity.cookie);

        const smidCookie = cookies.find(cookie => cookie.name === 'SMID');
        if (!smidCookie) {
            throw new BadRequestException('Cookie SMID не найден.');
        }

        const payload: JwtPayload = {
            smid: smidCookie.value,
            ip: ipAddress,
            exp: Math.floor(mirrorEntry.mirrorTokenExpiry.getTime() / 1000),
        };
        const jwtToken = await this.jwtService.signAsync(payload, { secret: this.botToken });
        return { jwtToken, smid: smidCookie.value, domain: this.domain, expiry: mirrorEntry.mirrorTokenExpiry };
    }
}
