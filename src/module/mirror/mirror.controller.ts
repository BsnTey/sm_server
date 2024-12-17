import { Controller } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { ConfigService } from '@nestjs/config';

@Controller('mirror')
export class MirrorController {
    private DOMAIN = this.configService.getOrThrow('DOMAIN', 'http://localhost:3001');

    constructor(
        private accountService: AccountService,
        private configService: ConfigService,
    ) {}

    // @Get(':accountId')
    // @HttpCode(200)
    // async onMirror(@Param() params: AccountIdParamsDto, @Res({ passthrough: true }) res: Response) {
    //     const accountEntity = await this.accountService.getAccount(params.accountId);
    //     const cookies: Cookie[] = JSON.parse(accountEntity.cookie);
    //     const domain = this.DOMAIN.split('://')[1];
    //
    //     const smid = cookies.find(cookie => {
    //         if (cookie.name == 'SMID') return true;
    //     });
    //
    //     res.clearCookie('SMID');
    //
    //     const twoYearsFromNow = new Date();
    //     twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    //
    //     res.cookie('SMID', smid!.value, {
    //         domain,
    //         httpOnly: true,
    //         path: '/',
    //         sameSite: 'lax',
    //         secure: true,
    //         expires: twoYearsFromNow,
    //     });
    //
    //     return res.redirect('/');
    // }
}
