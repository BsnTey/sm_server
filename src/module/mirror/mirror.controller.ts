import { Controller, Get, Headers, HttpCode, Param, Res } from '@nestjs/common';
import { AccountIdParamsDto } from '../account/dto/uuid-account.dto';
import { Response } from 'express';
import { AccountService } from '../account/account.service';
import { Cookie } from '../account/interfaces/cookie.interface';

@Controller('mirror')
export class MirrorController {
    constructor(private accountService: AccountService) {}

    @Get(':accountId')
    @HttpCode(200)
    async onMirror(@Param() params: AccountIdParamsDto, @Headers('Host') host: string, @Res({ passthrough: true }) res: Response) {
        const accountEntity = await this.accountService.getAccount(params.accountId);
        const cookies: Cookie[] = JSON.parse(accountEntity.cookie);

        const smid = cookies.find(cookie => {
            if (cookie.name == 'SMID') return true;
        });

        res.cookie('SMID', smid!.value, {
            domain: 'www.nonofficialsport.ru',
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: false,
        });

        return res.redirect('/');
    }
}
