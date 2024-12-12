import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ERROR_INTEGER } from '../constants/error.constant';

@Injectable()
export class isMoneyAmountPipe implements PipeTransform<string> {
    transform(amountCount: string, metadata: ArgumentMetadata): number {
        const amount = Math.floor(Number(amountCount));

        if (!Number.isInteger(amount)) {
            throw new BadRequestException(ERROR_INTEGER);
        }
        // if (amount < 500) {
        //     throw new BadRequestException(ERROR_LOW_MONEY_COUNT);
        // }
        // if (amount % 50 !== 0) {
        //     throw new BadRequestException(ERROR_NOT_MULTIPLE_OF_50);
        // }

        return amount;
    }
}
