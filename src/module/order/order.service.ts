import { Injectable } from '@nestjs/common';
import { AccountService } from '../account/account.service';

@Injectable()
export class OrderService {
    constructor(private accountService: AccountService) {}

    async getOrder(accountId: string, orderNumber: string) {
        return await this.accountService.orderInfo(accountId, orderNumber);
    }
}
