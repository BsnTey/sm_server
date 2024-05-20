export interface PickupAvabilityInterface {
    data: Data;
}

export interface Data {
    list: ShopList[];
}

export interface ShopList {
    shop: Shop;
    potentialOrders: PotentialOrder[];
    unavailableItems: any[];
}

export interface PotentialOrder {
    totalAvailabilityDate: string;
    totalAvailabilityDateTime: string;
    territoryDate: string;
    totalPrepay: boolean;
    availability: string;
    availableItems: AvailableItem[];
    storeDays: number;
    deliveryPrice: DeliveryPrice;
}

export interface DeliveryPrice {
    value: number;
    currency: string;
}

export interface AvailableItem {
    productId: string;
    sku: number;
    linesIds: string[];
}

export interface Shop {
    id: string;
    address: string;
    shopNumber: number;
    name: string;
    weekSchedule: WeekSchedule[];
    shopFormat: ShopFormat;
    geoPoint: GeoPoint;
    metroStations: any[];
    isConvenience: boolean;
    shopCondition: string;
    phone: Phone;
    city: City;
    shopWay?: any;
    inventory?: any;
}

export interface City {
    id: string;
    name: string;
    eutc?: any;
    macrocityId?: any;
    hasMetro?: any;
}

export interface Phone {
    countryCode: number;
    nationalNumber: number;
    isoCode: string;
}

export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface ShopFormat {
    id: string;
    onlineShopName: string;
    image: string;
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
