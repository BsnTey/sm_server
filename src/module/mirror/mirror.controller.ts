import { BadRequestException, Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { MirrorService } from './mirror.service';

@Controller('mirror')
export class MirrorController {
    constructor(private mirrorService: MirrorService) {}

    @Get('auth')
    async accessMirror(@Query('token') mirrorToken: string, @Res({ passthrough: true }) res: Response, @Req() request: Request) {
        if (!mirrorToken) {
            throw new BadRequestException('Неверный запрос');
        }
        const mirrorEntry = await this.mirrorService.validateMirrorToken(mirrorToken);
        const ipAddress = Array.isArray(request.headers['x-forwarded-for'])
            ? request.headers['x-forwarded-for'][0]
            : request.headers['x-forwarded-for'] || request.ip;

        if (!ipAddress || mirrorEntry.userIp !== ipAddress) {
            throw new BadRequestException('Неверный запрос');
        }

        const { jwtToken, smid, domain, expiry } = await this.mirrorService.createJwt(mirrorEntry);
        console.log('до удаления', res.cookie);
        res.clearCookie('SMID');
        res.clearCookie('jwt');

        const cookies = Object.keys(request.cookies);
        for (const cookieName of cookies) {
            res.clearCookie(cookieName);
        }

        console.log('после удаления', res.cookie);

        // res.cookie('SMID', smid, {
        //     domain,
        //     httpOnly: true,
        //     path: '/',
        //     sameSite: 'lax',
        //     secure: true,
        //     expires: expiry,
        // });

        const twoYearsFromNow = new Date();
        twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

        res.cookie('SMID', smid, {
            domain,
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: true,
            expires: twoYearsFromNow,
        });

        res.cookie('jwt', jwtToken, {
            domain,
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: true,
            expires: expiry,
        });
        console.log('итог', res.cookie);
        return res.redirect('/');
    }
}
