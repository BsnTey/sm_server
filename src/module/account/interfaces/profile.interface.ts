import { Address } from './geo.interface';

export interface DataProfile {
    profile: Profile;
}

export interface Profile {
    id: string;
    userGateUid: string;
    city?: any;
    type: string;
    userType: string;
    isUserCityConfirmed?: any;
    anketa: Anketa;
    phone: Phone;
    email: Email;
    avatar?: any;
    referralProgramAvailable?: any;
    location?: any;
    agreeToEmailSubscriptions: boolean;
    locationUpdate?: any;
    agreements: Agreements;
}

export interface Agreements {
    personalData: boolean;
    advertising: boolean;
}

export interface Email {
    email: string;
    isConfirmed: boolean;
}

export interface Phone {
    countryCode: number;
    nationalNumber: number;
    isoCode: string;
}

export interface Anketa {
    firstName: string;
    lastName: string;
    middleName?: any;
    sex: string;
    birthDate: string;
    territoryId?: any;
    territoryName?: any;
    streetId?: any;
    streetName?: any;
    houseId?: any;
    house?: any;
    address: Address;
    trainerState: TrainerState;
    requiredFields: RequiredField[];
    children?: any;
}

export interface RequiredField {
    title: string;
    description?: string;
    isFilled: boolean;
}

export interface TrainerState {
    isVerified: boolean;
}
