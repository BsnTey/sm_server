import { ICourseTokens } from '../interfaces/account.interface';

export class CourseTokensEntity implements ICourseTokens {
    userGateToken: string;
    accessTokenCourse: string;
    refreshTokenCourse: string;
    isValidAccessTokenCourse: boolean;

    constructor(tokens: ICourseTokens) {
        Object.assign(this, tokens);
        return this;
    }
}
