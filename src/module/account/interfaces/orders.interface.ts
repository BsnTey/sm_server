export interface OrdersInterface {
    data: Data;
}

export interface Data {
    orders: Order[];
    filters: Filter[];
}

export interface Filter {
    id: string;
    name: string;
    isSelected: boolean;
}

export interface Order {
    number: string;
    receiptCode?: string;
    date: string;
    status: Status;
    totalSum: TotalSum;
    deliveryType: DeliveryType;
    showQrCode: boolean;
    needPayment?: boolean;
    prepayLimitTime?: any;
}

export interface DeliveryType {
    title: string;
    value: string;
}

export interface TotalSum {
    value: number;
    currency: string;
}

export interface Status {
    status: string;
    statusText: string;
    statusDate?: any;
    textColor: string;
    backgroundColor: string;
}
