export interface CartInterface {
    data: Cart;
}

export interface Cart {
    cartFull: CartFull;
    cartLite?: any;
}

export interface CartFull {
    version: number;
    availableItems: AvailableItem[];
    unselectedItems?: any;
    unallocatedItems: CartItemId[];
    deletedItems: any[];
    soldOutLines: any[];
    promoCodes: any[];
    obtainPoints: any[];
    owner: Owner;
    banners: any[];
    bankProducts: BankProducts;
    totals: Totals;
    dailyOfferExpiresIn?: any;
    deliveryInfo: DeliveryInfo2;
    bonusesInfo: BonusesInfo;
    altPotentialOrders: AltPotentialOrders;
    receiver?: any;
}

export interface AltPotentialOrders {
    intPickup?: any;
    courierDelivery?: any;
}

export interface BonusesInfo {
    bonusApplied: boolean;
    isBonusAvailable: boolean;
    bonusInfoDocumentId: string;
    potentialBonuses: number;
}

export interface DeliveryInfo2 {
    unallocatedItemsDeliveryTypes: string[];
    allocatedItemsDeliveryTypes: any[];
}

export interface Totals {
    productsAmount: number;
    catalogDiscount: ItemPrice;
    priceWoDiscount: ItemPrice;
    bonuses: ItemPrice;
    promo: ItemPrice;
    total: ItemPrice;
    totalDeliveryCost: ItemPrice;
    totalWoDelivery: ItemPrice;
    pendingPotentialBonuses: number;
    pendingPotentialBonusesPromo: PendingPotentialBonusesPromo[];
}

export interface PendingPotentialBonusesPromo {
    mdmId: number;
    name: string;
    amount: number;
}

export interface BankProducts {
    installmentBanner: InstallmentBanner;
    creditBanner: InstallmentBanner;
    bnplSovcombankBanner: InstallmentBanner;
    isCreditAvailable: boolean;
    isInstallmentAvailable: boolean;
    isBnplSovcombankAvailable: boolean;
}

export interface InstallmentBanner {
    id: string;
    bannerHeader: string;
    bannerText: string;
    image: string;
    url: string;
    slot: string;
}

export interface Owner {
    profileId: string;
    fio: string;
    phone: Phone;
    email: string;
}

export interface Phone {
    countryCode: number;
    nationalNumber: number;
    isoCode: string;
}

export interface AvailableItem {
    cartItemId: CartItemId;
    name: string;
    image: string;
    params: Param[];
    quantity: number;
    availableAmount: number;
    itemPrice: ItemPrice;
    itemPriceWoDiscount: ItemPrice;
    totalPrice: ItemPrice;
    totalPriceWoDiscount: ItemPrice;
    badges: Badge[];
    hasInstallment: boolean;
    deliveryInfo: DeliveryInfo;
    wareAdditionDate: string;
    catalogPrice: ItemPrice;
    catalogDiscount: ItemPrice;
}

export interface DeliveryInfo {
    deliveryTypes: DeliveryType[];
    onlyIntPickup: boolean;
    isExpressDeliveryEnabled: boolean;
    isDeliveryServicesEnabled: boolean;
}

export interface DeliveryType {
    title: string;
    value: string;
}

export interface Badge {
    id: string;
    title: string;
    bgColor: string;
    textColor: string;
    type: string;
    description: string;
    url?: any;
}

export interface ItemPrice {
    value: number;
    currency: string;
}

export interface Param {
    name: string;
    value: string;
}

export interface CartItemId {
    productId: string;
    sku: number;
    linesIds: string[];
}
