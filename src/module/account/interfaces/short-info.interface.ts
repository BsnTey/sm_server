export interface ShortInfoInterface {
    bonusCount: number;
    qrCode: string;
    bonusDetails: Detail[];
    citySMName: string;
}

interface Detail {
    bonusType: string;
    amount: number;
    dateEnd: string;
}
