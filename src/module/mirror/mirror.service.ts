import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common'; // Import JwtService

@Injectable()
export class MirrorLinkService {
    constructor(private jwtService: JwtService) {}

    async generateLink(accountId: string, ipAddress: string, smidCookieValue: string): Promise<string> {
        const payload = {
            sub: accountId,
            ip: ipAddress,
            smid: smidCookieValue,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
        };
        const token = await this.jwtService.signAsync(payload);
        return `/mirror/${token}`;
    }
}
