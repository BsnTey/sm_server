import { GeoPointLon } from './geo.interface';

export interface OrderInfoInterface {
    data: Data;
}

export interface Data {
    order: Order;
}

export interface Order {
    number: string;
    createdDate: string;
    status: Status;
    needPrepay: boolean;
    deliveryInfo: DeliveryInfo;
    payment: Payment;
    totals: Totals;
    items: Item[];
    services?: any;
    possibleActions: string[];
    cancelReasons: CancelReason[];
    isCancelled: boolean;
    promoCodes: any[];
    statusHistory: StatusHistory[];
    orderCancelNotification?: any;
    isCancelling: boolean;
    authCode?: any;
    showQrCode: boolean;
}

export interface StatusHistory {
    status: string;
    statusText: string;
    statusDate: string;
    textColor?: any;
    backgroundColor?: any;
}

export interface CancelReason {
    reasonId: string;
    reasonName: string;
    allowComment: boolean;
}

export interface Item {
    productId: string;
    skuId: number;
    amount: number;
    name: string;
    totalPrice: TotalCatalogCost;
    priceWoDiscount: TotalCatalogCost;
    catalogDiscount: TotalCatalogCost;
    sumTotalPrice: TotalCatalogCost;
    sumPriceWoDiscount: TotalCatalogCost;
    sumDiscount: TotalCatalogCost;
    image: string;
    params: Param[];
}

export interface Param {
    name: string;
    value: string;
}

export interface Totals {
    totalCatalogCost: TotalCatalogCost;
    totalDeliveryCost: TotalCatalogCost;
    totalServicesCost: TotalCatalogCost;
    totalBonusesUsed: TotalCatalogCost;
    totalCost: TotalCatalogCost;
    promocodeDiscount: TotalCatalogCost;
    catalogDiscount: TotalCatalogCost;
    egcPaid?: any;
    egcToPay?: any;
}

export interface TotalCatalogCost {
    value: number;
    currency: string;
}

export interface Payment {
    needPayment: boolean;
    prepayLimitTime?: any;
    isPayed: boolean;
    paymentMethod: PaymentMethod;
    paymentTools: string[];
    promoList: any[];
    eCheckUrl?: any;
}

export interface PaymentMethod {
    id: string;
    name: string;
    paymentMethod: string;
}

export interface DeliveryInfo {
    type: Type;
    delivery?: any;
    extPickup?: any;
    intPickup: IntPickup;
    receivingDateFrom?: any;
    planReceivingDateTimeFrom: string;
    receivingDateTo?: any;
    receivingTimeSlot?: any;
    territoryDate?: any;
    storagePeriod?: any;
    receiver: Receiver;
    shippingMethod: string;
    shippingMethodLevel: string;
    deliveryServiceCancellingMessage?: any;
    deliveryClickInfo?: any;
}

export interface Receiver {
    fio: string;
    phone: ShopPhone;
    email: string;
}

export interface IntPickup {
    shopId: string;
    shopAddress: string;
    shopName: string;
    shopPhone: ShopPhone;
    geoPoint: GeoPointLon;
    weekSchedule: WeekSchedule[];
    convenienceShop: boolean;
    inventory?: any;
    isPickUpAutoAvailable: boolean;
}

export interface WeekSchedule {
    dayNumber: number;
    dayName: string;
    workTime: WorkTime;
}

export interface WorkTime {
    workStartTime: string;
    workEndTime: string;
}

export interface ShopPhone {
    countryCode: number;
    nationalNumber: number;
    isoCode: string;
}

export interface Type {
    title: string;
    value: string;
}

export interface Status {
    status: string;
    statusText: string;
    statusDate?: any;
    textColor: string;
    backgroundColor: string;
}
