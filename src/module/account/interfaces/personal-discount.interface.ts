export interface PersonalDiscount {
    list: List[];
    personalDiscountsInfo?: any;
}

export interface List {
    base: Base;
    dateBegin: string;
    dateEnd: string;
    nodeName: string;
    url: string;
    miniatures: string[];
    discountCode: string;
    buttonType: string;
    badges: Badge[];
    discountPercent: number;
    showDate: boolean;
}

export interface Badge {
    title: string;
    bgColor: string;
    textColor: string;
    type: string;
    icon?: any;
    expiresIn?: any;
}

export interface Base {
    nodeId: string;
}

export interface PersonalDiscountResponse {
    dateEnd: string;
    nodeName: string;
}

export type ErrorItem = { accountId: string; error: string };
