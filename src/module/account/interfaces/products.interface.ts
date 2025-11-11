export interface Products {
    list: List[];
    hasMore: boolean;
    meta: Meta;
}

interface Meta {
    facets: Facet[];
    sorts: Sort[];
    category: Category;
    count: number;
    subqueryReference: string;
    subqueryRefWoFacets: string;
    queryTextCorrection?: any;
    productRedirect: boolean;
    mediaRedirect: boolean;
    mediaLink?: any;
    shareLink?: any;
    dailyOfferExpiresIn?: any;
    seller?: any;
    alternativeRedirect: boolean;
    obtainmentPlate: ObtainmentPlate;
    quickFacets: string[];
}

interface ObtainmentPlate {
    obtainment?: any;
    showPlate: boolean;
}

interface Category {
    id: string;
    name: string;
    uri: string;
    image?: any;
    displayCode?: any;
    type: string;
    catalogDisplayPatternCode?: any;
}

interface Sort {
    value: string;
    isAvailable: boolean;
    selectedByUser: boolean;
    subqueryReference: string;
    subqueryColorModelCount: number;
    uiCaption: string;
    color?: any;
    availableShops?: any;
    range?: any;
    badge?: any;
    siteTip?: any;
    maxLength?: any;
}

interface Facet {
    facetId: string;
    caption: string;
    facetValues: FacetValue[];
    displayType: string;
    subqueryWoFacetVals?: any;
    siteTip?: string;
}

interface FacetValue {
    value: string;
    isAvailable: boolean;
    selectedByUser: boolean;
    subqueryReference: string;
    subqueryColorModelCount: number;
    uiCaption?: string;
    color?: Color;
    availableShops?: (AvailableShop[] | null)[];
    range?: Range;
    badge?: any;
    siteTip?: string;
    maxLength?: any;
}

interface Range {
    min: number;
    max: number;
    from: number;
    to: number;
}

interface AvailableShop {
    shopId: string;
    selectedByUser: boolean;
    subqueryReference: string;
}

interface Color {
    value: string;
    icon?: string;
}

export interface List {
    id: string;
    name: string;
    code: string;
    skus: Skus[];
    price: Price;
    rating: number;
    reviews: number;
    markers: Marker[];
    dailyOfferExpiresIn?: any;
    primaryPhotoUrl: string;
    medias: Media[];
    brand: Brand;
    linkedColorModels: LinkedColorModel[];
    sizeScale?: SizeScale;
    shareLink: string;
    archived: boolean;
    productSetAvailable: boolean;
    personalPrice: PersonalPrice;
    onSaleSoon: boolean;
    hasAssociatedAttributes: boolean;
    sizeTableName: string;
    bnpk?: any;
    expertHints?: ExpertHint;
    sizeML?: any;
}

interface ExpertHint {
    summary?: any;
    features?: any;
}

interface PersonalPrice {
    price: Catalog;
    discountList: DiscountList[];
    info?: any;
    potentialBonuses?: any;
    coupon?: any;
    personalPromo?: any;
}

interface DiscountList {
    actionName: string;
    summa: Catalog;
    actionCode?: number;
    discountType?: any;
}

interface SizeScale {
    name: string;
    tableHtml: string;
    jpgImageUrl?: any;
}

interface LinkedColorModel {
    id: string;
    compositeColor: CompositeColor;
    photoUrl: string;
}

interface CompositeColor {
    text: string;
    hexColor: string;
}

interface Brand {
    name: string;
    image: string;
    url: string;
    imageBreadCrumbs: string;
}

interface Media {
    type: string;
    urls: string[];
}

interface Marker {
    id: string;
    title: string;
    backgroundColor: string;
    textColor: string;
    icon?: any;
    type: string;
    typeEditor: string;
    description?: any;
    url?: any;
}

interface Price {
    catalog: Catalog;
    retail: Catalog;
    discountRate: number;
    discountAmount: Catalog;
}

interface Catalog {
    value: number;
    currency: string;
}

interface Skus {
    id: string;
    code: string;
    availability: Availability;
    sizes: Size[];
    sizeFacetValue: string;
    isReplenishment: boolean;
    associatedAttributes: any[];
}

interface Size {
    id: number;
    name?: string;
    value: string;
    footValue?: any;
}

interface Availability {
    isOnlineAvailable: boolean;
    isOfflineAvailable: boolean;
}
