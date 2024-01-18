import { IsEmail, IsInt, IsJSON, IsJWT, IsNotEmpty, IsString, IsUUID } from "class-validator";


export class CreateAccountDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    passImap: string;

    @IsString()
    @IsNotEmpty()
    passEmail: string;

    @IsJSON()
    @IsNotEmpty()
    cookie: string;

    @IsJWT()
    @IsNotEmpty()
    accessToken: string;

    @IsJWT()
    @IsNotEmpty()
    refreshToken: string;

    @IsString()
    @IsNotEmpty()
    xUserId: string;

    @IsUUID()
    @IsNotEmpty()
    deviceId: string;

    @IsUUID()
    @IsNotEmpty()
    installationId: string;

    @IsInt()
    @IsNotEmpty()
    expiresIn: number;

    @IsInt()
    bonusCount: string;
  }
