import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TelegrafException, TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ERROR_ACCESS } from '../../constants/error.constant';
import { UserService } from '../../../user/user.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class SellerGuard implements CanActivate {
    constructor(private readonly userService: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const ctx = TelegrafExecutionContext.create(context);
        const { from } = ctx.getContext<Context>();

        const user = await this.userService.getUserByTelegramId(String(from!.id));
        if (!user?.role) throw new TelegrafException(ERROR_ACCESS);

        const isSeller = user.role === UserRole.Admin || user.role === UserRole.Seller;
        if (!isSeller) {
            throw new TelegrafException(ERROR_ACCESS);
        }

        return true;
    }
}
