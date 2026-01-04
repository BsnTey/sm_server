import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountService } from '../../../account/account.service';
import validate from 'uuid-validate';
import { AxiosError } from 'axios';
import { addDays, isBefore, parseISO } from 'date-fns';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { OrderService } from '../../../order/order.service';

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
    private readonly TIMEOUT = 15000;

    constructor(
        private readonly accountService: AccountService,
        private readonly orderService: OrderService,
    ) {}

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
        const accountChunks = this.chunkArray(accounts, 5);

        for (const chunk of accountChunks) {
            await Promise.all(chunk.map(account => this.processWithTimeout(processAccount, resultChecking, account)));
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

    private async processWithTimeout(
        processAccount: (resultChecking: Record<string, string>, accountId: string) => Promise<void>,
        resultChecking: Record<string, string>,
        accountId: string,
    ): Promise<void> {
        const timeoutPromise = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${accountId} took too long to process`)), this.TIMEOUT),
        );

        try {
            await Promise.race([processAccount(resultChecking, accountId), timeoutPromise]);
        } catch {
            resultChecking[accountId] = `${accountId}: Ошибка тайм-аута\n`;
        }
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
            try {
                await this.orderService.orderHistory(trimmedAccountId);
            } catch {
                //ignore
            }

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
        const logFilePath = path.join(__dirname, 'error_log.txt');

        if (err instanceof NotFoundException) {
            resultChecking[accountId] = `${accountId}: Не найден\n`;
        } else if (err instanceof AxiosError) {
            try {
                const errorResponse = err.response?.data?.error;

                if (errorResponse?.message) {
                    const errorMessage = `${new Date().toISOString()} - Account ID: ${accountId} - Axios Error1: ${JSON.stringify(errorResponse, null, 2)}\n`;
                    fs.appendFileSync(logFilePath, errorMessage, 'utf8');

                    resultChecking[accountId] = `${accountId}: ${errorResponse.message}\n`;
                } else {
                    const errorMessage = `${new Date().toISOString()} - Account ID: ${accountId} - Axios Error2: ${JSON.stringify(err.response?.data || err.toJSON(), null, 2)}\n`;
                    fs.appendFileSync(logFilePath, errorMessage, 'utf8');

                    resultChecking[accountId] = `${accountId}: Ошибка запроса, повторите\n`;
                }
            } catch (writeError: any) {
                const writeErrorMessage = `${new Date().toISOString()} - Account ID: ${accountId} - Write Error3: ${writeError.message}\n`;
                fs.appendFileSync(logFilePath, writeErrorMessage, 'utf8');

                resultChecking[accountId] = `${accountId}: Ошибка запроса, повторите\n`;
            }
        } else {
            try {
                const errorMessage = `${new Date().toISOString()} - Account ID: ${accountId} - Error4: ${err.message}\n`;
                fs.appendFileSync(logFilePath, errorMessage, 'utf8');
                resultChecking[accountId] = `${accountId}: ${err.message || 'Неизвестная ошибка'}\n`;
            } catch (writeError: any) {
                const writeErrorMessage = `${new Date().toISOString()} - Account ID: ${accountId} - Write Error5: ${writeError.message}\n`;
                fs.appendFileSync(logFilePath, writeErrorMessage, 'utf8');
                resultChecking[accountId] = `${accountId}: Неизвестная ошибка\n`;
            }
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
                if (
                    actionName === 'Скидка 10% на первый онлайн заказ' ||
                    actionName === '-15% на туризм и рыбалку' ||
                    actionName === '-15% на обувь для горного туризма' ||
                    actionName === '-20% на фитнес-аксессуары'
                ) {
                    continue;
                }
                if (actionName === '-10% по промокоду на онлайн-покупку') {
                    const textLegal = promo.textLegal;
                    if (textLegal && textLegal.includes('Промокод не суммируется')) {
                        continue;
                    }
                }
                const promoId = promo.promoId;
                const dateEnd = promo.dateEnd;
                promocodes += `${actionName} <b><code>${promoId}</code></b> ${dateEnd} `;
            }

            resultChecking[trimmedAccountId] = accountInfo + (promocodes || 'Нет промо') + '\n';
        } catch (err: any) {
            this.handleError(err, trimmedAccountId, resultChecking);
        }
    }

    toTelegramChunks(parts: Array<string | undefined | null>, limit = 4096): string[] {
        const out: string[] = [];
        let buf = '';

        for (const part of parts) {
            const s = part ?? '';
            if (s.length === 0) continue;

            if (s.length > limit) {
                if (buf) {
                    out.push(buf);
                    buf = '';
                }
                for (let i = 0; i < s.length; i += limit) {
                    out.push(s.slice(i, i + limit));
                }
                continue;
            }

            if (buf.length + s.length > limit) {
                out.push(buf);
                buf = s;
            } else {
                buf += s;
            }
        }

        if (buf) out.push(buf);
        return out;
    }
}
