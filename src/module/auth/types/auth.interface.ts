export interface IJWTPayload {
    sub: string;
    role: string;
}

export interface IUserJwtPayload {
    uuid: string;
    role: string;
}

export interface TokenResponseDto {
    accessToken: string;
}
