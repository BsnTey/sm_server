export interface ShortInfoInterface {
    bonusCount: number;
    qrCode: string;
    bonusDetails: Detail[];
    citySMName: string;
    bonusLevel: string;
}

export interface ShorInfo {
    info: Info;
}

export interface ShorInfoData {
    data: ShorInfo;
}

export interface Info {
    totalAmount: number;
    cashLevel: number;
    cashAmount: number;
    promoAmount: number;
    bonusLevel: BonusLevel;
    clubCard: ClubCard;
    details: Detail[];
    privatePersonType: PrivatePersonType;
    familyMemberStatus: string;
}

export interface PrivatePersonType {
    title: string;
    value: string;
}

export interface Detail {
    bonusType: string;
    amount: number;
    dateEnd: string;
}

export interface ClubCard {
    qrCode: string;
}

export interface BonusLevel {
    name: string;
    code: string;
}
