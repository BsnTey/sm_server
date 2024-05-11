import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ZennoGuard implements CanActivate {
    constructor(private configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        try {
            const request = context.switchToHttp().getRequest();
            const zennoHashRequest = request.headers['zenno'];
            const ZENNO_HASH = this.configService.getOrThrow('ZENNO_HASH');
            return zennoHashRequest == ZENNO_HASH;
        } catch {
            return false;
        }
    }
}
