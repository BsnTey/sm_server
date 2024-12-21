import { BadRequestException, Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { MirrorService } from './mirror.service';

@Controller('mirror')
export class MirrorController {
    constructor(private mirrorService: MirrorService) {}

    @Get('auth')
    async accessMirror(@Query('token') mirrorToken: string, @Res({ passthrough: true }) res: Response, @Req() request: Request) {
        console.log('зашел в accessMirror', mirrorToken);
        if (!mirrorToken) {
            throw new BadRequestException('Неверный запрос');
        }
        const mirrorEntry = await this.mirrorService.validateMirrorToken(mirrorToken);
        console.log('зашел в validateMirrorToken', mirrorEntry.id);
        const ipAddress = Array.isArray(request.headers['x-forwarded-for'])
            ? request.headers['x-forwarded-for'][0]
            : request.headers['x-forwarded-for'] || request.ip;

        if (!ipAddress || mirrorEntry.userIp !== ipAddress) {
            throw new BadRequestException('Неверный запрос');
        }

        console.log('зашел в ipAddress', ipAddress);

        const { jwtToken, smid, domain, expiry } = await this.mirrorService.createJwt(mirrorEntry);
        console.log('зашел в createJwt', jwtToken, smid, domain);

        res.cookie('SMID', smid, {
            domain,
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: true,
            expires: expiry,
        });
        res.cookie('jwt', jwtToken, {
            domain,
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: true,
            expires: expiry,
        });
        console.log('зашел в redirect');
        return res.redirect('/');
    }
}
