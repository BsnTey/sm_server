import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

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

  @IsNotEmpty()
  cookie: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsString()
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

  @IsString()
  @IsNotEmpty()
  bonusCount: string;
}
