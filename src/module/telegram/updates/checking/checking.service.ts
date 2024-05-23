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
        const resultChecking: Record<string, string> = {};

        await Promise.all(accounts.map(account => this.processCheckingAccount(resultChecking, account)));

        return this.bringCompliance(resultChecking, accounts);
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

            const filteredBonusDetails = bonusDetails.filter(detail => detail.amount >= 100);
            const firstBonusDate = this.getCombustionDates(filteredBonusDetails);

            if (firstBonusDate) {
                const { amount: firstAmount, date: firstDate } = firstBonusDate;
                result += ` ${firstDate} - ${firstAmount}`;

                const secondBonusDate = this.getCombustionDates(filteredBonusDetails, firstDate);
                if (secondBonusDate) {
                    const { amount: secondAmount, date: secondDate } = secondBonusDate;
                    result += ` ${secondDate} - ${secondAmount}`;
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

    async checkingAccountsOnPromocodes(accounts: string[]): Promise<string[]> {
        const resultChecking: Record<string, string> = {};

        await Promise.all(accounts.map(account => this.processCheckingAccountOnPromocode(resultChecking, account)));

        return this.bringCompliance(resultChecking, accounts);
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

            resultChecking[trimmedAccountId] = accountInfo + (promocodes || 'Нет доступных промокодов') + '\n';
        } catch (err: any) {
            this.handleError(err, trimmedAccountId, resultChecking);
        }
    }
}
