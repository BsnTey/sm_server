import { Location, City } from './geo.interface';

export interface AnonymResponse {
    data: AnonymData;
}

export interface AnonymData {
    token: Token;
    profile: Profile;
    authEvent?: any;
}

export interface Profile {
    id: string;
    userGateUid: null;
    city: City;
    type: 'guest';
    userType?: null;
    isUserCityConfirmed: boolean;
    anketa: null;
    phone: null;
    email: null;
    avatar: null;
    referralProgramAvailable?: any;
    location: Location;
    agreeToEmailSubscriptions: boolean;
    locationUpdate: string;
    agreements?: any;
}

export interface Token {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
