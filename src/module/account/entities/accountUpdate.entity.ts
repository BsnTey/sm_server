import { IUpdateAccount } from '../interfaces/account.interface';
import { RefreshTokensEntity } from './refreshTokens.entity';
import { UpdateAccountRequestDto } from '../dto/update-account.dto';

export class AccountUpdateEntity extends RefreshTokensEntity implements IUpdateAccount {
    xUserId: string;
    deviceId: string;
    installationId: string;
    isAccessMp: boolean;

    constructor(account: UpdateAccountRequestDto) {
        super(account);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        this.xUserId = account.xUserId;
        this.deviceId = account.deviceId;
        this.installationId = account.installationId;
        this.isAccessMp = true;

        Object.assign(this, account);
        return this;
    }
}
