import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        try {
            const accessRoles = this.reflector.get('roles', context.getHandler());
            if (!accessRoles) {
                return false;
            }
            const request = context.switchToHttp().getRequest();
            const userRole = request.user?.userRole;
            return accessRoles.includes(userRole);
        } catch {
            return false;
        }
    }
}
