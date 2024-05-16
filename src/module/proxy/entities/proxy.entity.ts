import { Proxy } from '@prisma/client';

export class ProxyEntity implements Proxy {
    uuid: string;
    proxy: string;
    expiresAt: Date;
    blockedAt: Date | null;

    createdAt: Date;
    updatedAt: Date;

    constructor(proxy: Partial<Proxy>) {
        Object.assign(this, proxy);
        return this;
    }
}
