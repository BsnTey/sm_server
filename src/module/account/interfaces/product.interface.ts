export interface ProductApiResponse {
    product: Product;
    details: Details;
}

interface Product {
    id: string;
    name: string;
    code: string;
    skus: Sku[];
    price: Price;
    rating: number;
    reviews: number;
    markers: Marker[];
    dailyOfferExpiresIn: number | null;
    primaryPhotoUrl: string;
    medias: Media[];
    brand: Brand;
    linkedColorModels: unknown[];
    sizeScale: SizeScale;
    shareLink: string;
    archived: boolean;
    productSetAvailable: boolean;
    personalPrice: PersonalPrice;
    onSaleSoon: boolean;
    hasAssociatedAttributes: boolean;
    sizeTableName: string;
    bnpk: unknown | null;
    expertHints: unknown | null;
    sizeML: unknown | null;
}

interface Sku {
    id: string;
    code: string;
    availability: {
        isOnlineAvailable: boolean;
        isOfflineAvailable: boolean;
    };
    sizes: Size[];
    sizeFacetValue: string;
    isReplenishment: boolean;
    associatedAttributes: unknown[];
}

interface Size {
    id: number;
    name: string | null;
    value: string;
    footValue: string | null;
}

interface Price {
    catalog: Money;
    retail: Money;
    discountRate: number;
    discountAmount: Money;
}

interface Money {
    value: number;
    currency: string;
}

interface Marker {
    id: string;
    title: string;
    backgroundColor: string;
    textColor: string;
    icon: string | null;
    type: string;
    typeEditor: string;
    description: string | null;
    url: string | null;
}

interface Media {
    type: 'PHOTO_2D' | 'VIDEO' | string;
    urls: string[];
}

interface Brand {
    name: string;
    image: string;
    url: string;
    imageBreadCrumbs: string;
}

interface SizeScale {
    name: string;
    tableHtml: string;
    jpgImageUrl: string | null;
}

interface PersonalPrice {
    price: Money;
    discountList: PersonalDiscount[];
    info: string;
    potentialBonuses: {
        total: number;
        potentialBonusList: Array<{ actionName: string; summa: number }>;
    };
    coupon: unknown | null;
    personalPromo: unknown | null;
}

interface PersonalDiscount {
    actionName: string;
    summa: Money;
    actionCode: number | null;
    discountType: string;
}

interface Details {
    description: string | null;
    barcode: string | null;
    bnplMarker: string | null;
    bookmarks: Bookmark[];
    footLengthDescription: string | null;
    technologies: unknown[];
    documents: unknown[];
    richContent: unknown | null;
    richContentReadingTime: number | null;
    richAttributes: RichAttribute[];
    stickers: unknown[];
    breadCrumbs: BreadCrumb[];
    seller: unknown | null;
    classifyingAttributes: Array<{ id: string; name: string; value: string }>;
    altProductCharacteristicList: unknown | null;
    productKitsAvailable: boolean;
    videoBlock: unknown[];
    accordionTabs: unknown[];
    smartSuggestions: unknown | null;
}

interface Bookmark {
    id: string;
    name: string;
    values: Array<{
        id: string;
        name: string;
        values: string[];
    }>;
}

interface RichAttribute {
    richType: string;
    header: string | null;
    richText: string;
    mediaType: 'RICH_TEXT' | 'PHOTO_2D' | string;
    mediaUrls: string[];
    readingTime: number;
}

interface BreadCrumb {
    id: string;
    name: string;
    uri: string;
    categoryType: string;
    displayCode: string;
    image: string;
}
