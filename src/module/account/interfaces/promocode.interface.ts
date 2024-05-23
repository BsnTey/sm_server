export interface PromocodeInterface {
    data: Data;
}

export interface Data {
    list: Promocode[];
}

export interface Promocode {
    issueDate?: string;
    startDate: string;
    endDate: string;
    actionName: string;
    couponId: string;
    image: string;
    textLegal: string;
    textDetail: string;
    refDetail: string;
    color?: string;
}
