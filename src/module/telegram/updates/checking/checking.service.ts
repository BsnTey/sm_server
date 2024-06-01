import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountService } from '../../../account/account.service';
import validate from 'uuid-validate';
import { AxiosError } from 'axios';
import { addDays, isBefore, parseISO } from 'date-fns';

interface IOutputBonusDate {
    amount: number;
    date: string;
}

interface IBonusDetail {
    bonusType: string;
    amount: number;
    dateEnd: string;
}

@Injectable()
export class CheckingService {
    constructor(private readonly accountService: AccountService) {}

    async checkingAccounts(accounts: string[]): Promise<string[]> {
        return this.checkAccounts(accounts, this.processCheckingAccount.bind(this));
    }

    async checkingAccountsOnPromocodes(accounts: string[]): Promise<string[]> {
        return this.checkAccounts(accounts, this.processCheckingAccountOnPromocode.bind(this));
    }

    private async checkAccounts(
        accounts: string[],
        processAccount: (resultChecking: Record<string, string>, accountId: string) => Promise<void>,
    ): Promise<string[]> {
        const resultChecking: Record<string, string> = {};
        const accountChunks = this.chunkArray(accounts, 10);

        for (const chunk of accountChunks) {
            await Promise.all(chunk.map(account => processAccount(resultChecking, account)));
        }

        return this.bringCompliance(resultChecking, accounts);
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    private async processCheckingAccount(resultChecking: Record<string, string>, accountId: string): Promise<void> {
        const trimmedAccountId = accountId.trim();
        if (trimmedAccountId.length === 0) return;

        if (!validate(trimmedAccountId)) {
            resultChecking[trimmedAccountId] = `${trimmedAccountId}: Неверный формат\n`;
            return;
        }

        try {
            const { bonusCount, bonusDetails } = await this.accountService.shortInfo(trimmedAccountId);
            await this.accountService.orderHistory(trimmedAccountId);
            let result = `${trimmedAccountId}: ${bonusCount}`;
            const uniqueBonuses = new Set<string>();

            const filteredBonusDetails = bonusDetails.filter(detail => detail.amount >= 100);
            const firstBonusDate = this.getCombustionDates(filteredBonusDetails);

            if (firstBonusDate) {
                const { amount: firstAmount, date: firstDate } = firstBonusDate;
                const firstBonusString = `${firstDate} - ${firstAmount}`;
                uniqueBonuses.add(firstBonusString);
                result += ` ${firstBonusString}`;

                const secondBonusDate = this.getCombustionDates(filteredBonusDetails, firstDate);
                if (secondBonusDate) {
                    const { amount: secondAmount, date: secondDate } = secondBonusDate;
                    const secondBonusString = `${secondDate} - ${secondAmount}`;
                    if (!uniqueBonuses.has(secondBonusString)) {
                        uniqueBonuses.add(secondBonusString);
                        result += ` ${secondBonusString}`;
                    }
                }
            }

            resultChecking[trimmedAccountId] = result + '\n';
        } catch (err: any) {
            this.handleError(err, trimmedAccountId, resultChecking);
        }
    }

    private bringCompliance(resultChecking: Record<string, string>, accounts: string[]): string[] {
        return accounts.map(account => {
            const trimmedAccount = account.trim();
            if (trimmedAccount === '') return '\n';
            return resultChecking[trimmedAccount];
        });
    }

    private getCombustionDates(data: IBonusDetail[], previousDate?: string): IOutputBonusDate | null {
        const threeWeeksFromNow = addDays(new Date(), 21);

        for (const detail of data) {
            const dateObject = parseISO(detail.dateEnd);

            if (isBefore(dateObject, threeWeeksFromNow)) {
                if (previousDate && isBefore(parseISO(previousDate), dateObject)) {
                    continue;
                }
                const formattedDate = dateObject
                    .toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                    })
                    .replace(/\//g, '/');

                return {
                    amount: detail.amount,
                    date: formattedDate,
                };
            }
        }
        return null;
    }

    private handleError(err: any, accountId: string, resultChecking: Record<string, string>): void {
        if (err instanceof NotFoundException) {
            resultChecking[accountId] = `${accountId}: Не найден\n`;
        } else if (err instanceof AxiosError) {
            resultChecking[accountId] = `${accountId}: ${err.response?.data.error.message || 'Ошибка сети'}\n`;
        } else {
            resultChecking[accountId] = `${accountId}: ${err.message}\n`;
        }
    }

    private async processCheckingAccountOnPromocode(resultChecking: Record<string, string>, accountId: string): Promise<void> {
        const trimmedAccountId = accountId.trim();
        if (trimmedAccountId.length === 0) return;

        if (!validate(trimmedAccountId)) {
            resultChecking[trimmedAccountId] = `${trimmedAccountId}: Неверный формат\n`;
            return;
        }

        try {
            const { data } = await this.accountService.getPromocodeFromProfile(trimmedAccountId);
            const accountInfo = `${trimmedAccountId}: `;
            let promocodes = '';

            for (const promo of data.list) {
                const actionName = promo.actionName;
                if (actionName === 'Скидка 10% на первый онлайн заказ' || actionName === '-15% на обувь для треккинга') {
                    continue;
                }
                if (actionName === '-10% по промокоду на онлайн-покупку') {
                    const textLegal = promo.textLegal;
                    if (textLegal && textLegal.includes('Промокод не суммируется')) {
                        continue;
                    }
                }
                const couponId = promo.couponId;
                const endDate = promo.endDate;
                promocodes += `${actionName} ${couponId} ${endDate} `;
            }

            resultChecking[trimmedAccountId] = accountInfo + (promocodes || 'Нет промо') + '\n';
        } catch (err: any) {
            this.handleError(err, trimmedAccountId, resultChecking);
        }
    }
}
