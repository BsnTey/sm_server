import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import basicAuth from 'express-basic-auth';

@Injectable()
export class BasicAuthMiddleware implements NestMiddleware {
    private readonly auth;

    constructor(private readonly configService: ConfigService) {
        const user = this.configService.getOrThrow<string>('DASHBOARD_BULL_USER');
        const pass = this.configService.getOrThrow<string>('DASHBOARD_BULL_PASS');

        this.auth = basicAuth({
            users: {
                [user]: pass,
            },
            challenge: true,
        });
    }

    use(req: Request, res: Response, next: NextFunction) {
        this.auth(req, res, next);
    }
}
