import { Controller } from '@nestjs/common';
import { AccountService } from '../account/account.service';
import { ConfigService } from '@nestjs/config';
import { MirrorLinkService } from './mirror.service';

@Controller('mirror')
export class MirrorController {
    private DOMAIN = this.configService.getOrThrow('DOMAIN', 'http://localhost:3001');
    private cookieDuration = 60 * 60 * 1000;

    constructor(
        private accountService: AccountService,
        private configService: ConfigService,
        private mirrorLinkService: MirrorLinkService,
    ) {}

    // @Get(':token')
    // async accessMirror(@Param('token') token: string, @Res({ passthrough: true }) res: Response, @Req() request: Request) {
    //     const ipAddress = request.ip;
    //     if (!ipAddress) {
    //         return 'Ошибка. Нет доступа';
    //     }
    //     const linkData = this.mirrorLinkService.validateLink(token, ipAddress);
    //
    //     if (!linkData) {
    //         return 'Ссылка недействительна, устарела или используется с другого IP-адреса.';
    //     }
    //
    //     const accountEntity = await this.accountService.getAccount(linkData.accountId);
    //     const cookies: any[] = JSON.parse(accountEntity.cookie);
    //     const domain = this.DOMAIN.split('://')[1];
    //
    //     const smidCookie = cookies.find(cookie => cookie.name === 'SMID');
    //
    //     if (smidCookie) {
    //         res.cookie('SMID', smidCookie.value, {
    //             domain,
    //             httpOnly: true,
    //             path: '/',
    //             sameSite: 'lax',
    //             secure: true,
    //             expires: new Date(Date.now() + this.cookieDuration),
    //         });
    //         return res.redirect('/');
    //     } else {
    //         return 'Ошибка: Cookie SMID не найден.';
    //     }
    // }
}
