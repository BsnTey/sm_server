import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IJWTPayload } from '../types/auth.interface';
import { UserContext } from '../types/user.context.interface';

@Injectable()
export class AccessStrategy extends PassportStrategy(Strategy, 'accessToken') {
    constructor(private readonly configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                request => {
                    return request.headers['authorization'];
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow('ACCESS_TOKEN_JWT_SECRET'),
            signOptions: {
                expiresIn: configService.getOrThrow('ACCESS_TOKEN_EXPIRATION'),
            },
        });
    }

    async validate(payload: IJWTPayload): Promise<UserContext> {
        return {
            sub: payload.sub,
            userRole: payload.role,
        };
    }
}
