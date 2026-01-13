export interface ProfileBonuses {
    buySum: number;
    details: Details;
    cashbackLevel: number;
    currentLevel: string;
    nextLevel: string;
    toNextLevelSum: number;
    levelConfirmation: LevelConfirmation;
    isFamilyAccount: boolean;
}

export interface LevelConfirmation {
    toConfirmLevelSumma: number;
    confirmLevelDate: string;
    levelValidityDate: string;
}

export interface Details {
    total: number;
    cashback: Cashback;
    promo: Cashback;
}

export interface Cashback {
    amount: number;
    amountToBeExpired: number;
}
