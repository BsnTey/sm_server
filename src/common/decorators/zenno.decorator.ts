import { applyDecorators, UseGuards } from '@nestjs/common';
import { ZennoGuard } from '../../module/account/guard/zenno.guard';

export const HasZenno = () => {
    return applyDecorators(UseGuards(ZennoGuard));
};
