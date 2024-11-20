import { IUpdateAccount } from '../interfaces/account.interface';
import { RefreshTokensEntity } from './refreshTokens.entity';
import { UpdateAccountRequestDto } from '../dto/update-account.dto';
import { CourseStatus } from '@prisma/client';

export class AccountUpdateEntity extends RefreshTokensEntity implements IUpdateAccount {
    xUserId: string;
    deviceId: string;
    installationId: string;
    isAccessMp: boolean;
    userGateToken: string;
    accessTokenCourse: string;
    refreshTokenCourse: string;
    isValidAccessTokenCourse: boolean;
    statusCourse: CourseStatus;

    constructor(account: UpdateAccountRequestDto) {
        super(account);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        this.xUserId = account.xUserId;
        this.deviceId = account.deviceId;
        this.installationId = account.installationId;
        this.isAccessMp = true;
        this.userGateToken = account.userGateToken;
        this.accessTokenCourse = account.accessTokenCourse;
        this.refreshTokenCourse = account.refreshTokenCourse;
        this.isValidAccessTokenCourse = true;
        this.statusCourse = account.statusCourse;

        Object.assign(this, account);
        return this;
    }
}
