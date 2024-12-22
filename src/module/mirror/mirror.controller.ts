import { BadRequestException, Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { MirrorService } from './mirror.service';
import { ConfigService } from '@nestjs/config';

@Controller('mirror')
export class MirrorController {
    private DOMAIN = this.configService.getOrThrow('DOMAIN', 'http://localhost:3001');

    constructor(
        private mirrorService: MirrorService,
        private configService: ConfigService,
    ) {}

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
        res.clearCookie('SMID');
        res.clearCookie('jwt');

        if (request.cookies) {
            const cookies = Object.keys(request.cookies);
            for (const cookieName of cookies) {
                res.clearCookie(cookieName, { domain: domain, path: '/' });
            }
        }

        console.log(request.cookies);

        let newDomain = this.DOMAIN.split('://')[1];
        newDomain = `www.${newDomain}`;

        res.cookie('SMID', smid, {
            domain: newDomain,
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: true,
            expires: expiry,
        });

        // res.cookie('SMID', smid, {
        //     domain,
        //     httpOnly: true,
        //     path: '/',
        //     sameSite: 'lax',
        //     secure: true,
        //     expires: expiry,
        // });
        res.cookie('jwt', jwtToken, {
            domain,
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: true,
            expires: expiry,
        });
        return res.redirect('/');
    }
}
