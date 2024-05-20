export interface SearchProductInterface {
    data: Data;
}

export interface Data {
    list: List[];
    hasMore: boolean;
    meta: Meta;
}

export interface Meta {
    facets: Facet[];
    sorts: Sort[];
    category?: any;
    count: number;
    subqueryReference: string;
    subqueryRefWoFacets: string;
    queryTextCorrection: QueryTextCorrection;
    productRedirect: boolean;
    mediaRedirect: boolean;
    mediaLink: string;
    dailyOfferExpiresIn?: any;
}

export interface QueryTextCorrection {
    initQueryText: string;
    correctedQueryText?: any;
}

export interface Sort {
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
}

export interface Facet {
    facetId: string;
    caption: string;
    facetValues: FacetValue[];
    displayType: string;
    subqueryWoFacetVals?: any;
    siteTip?: any;
}

export interface FacetValue {
    value: string;
    isAvailable: boolean;
    selectedByUser: boolean;
    subqueryReference: string;
    subqueryColorModelCount: number;
    uiCaption: string;
    color?: any;
    availableShops?: AvailableShop[];
    range?: any;
    badge?: any;
    siteTip?: any;
}

export interface AvailableShop {
    shopId: string;
    selectedByUser: boolean;
    subqueryReference: string;
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
    richMarker?: any;
    richIcon?: any;
    dailyOfferExpiresIn?: any;
    primaryPhotoUrl: string;
    medias: Media[];
    brand: Brand;
    linkedColorModels: LinkedColorModel[];
    sizeScale: SizeScale;
    shareLink: string;
    archived: boolean;
    productSetAvailable: boolean;
    personalPrice?: any;
    onSaleSoon: boolean;
    hasAssociatedAttributes: boolean;
    sizeTableName: string;
}

export interface SizeScale {
    name: string;
    tableHtml: string;
    jpgImageUrl?: any;
}

export interface LinkedColorModel {
    id: string;
    compositeColor: CompositeColor;
    photoUrl: string;
}

export interface CompositeColor {
    text: string;
    hexColor: string;
}

export interface Brand {
    name: string;
    image: string;
    url: string;
    imageBreadCrumbs: string;
}

export interface Media {
    type: string;
    urls: string[];
}

export interface Marker {
    id: string;
    title: string;
    backgroundColor: string;
    textColor: string;
    icon?: any;
    type: string;
    description?: any;
    url?: any;
}

export interface Price {
    catalog: Catalog;
    retail: Catalog;
    discountRate: number;
    discountAmount: Catalog;
}

export interface Catalog {
    value: number;
    currency: string;
}

export interface Skus {
    id: string;
    code: string;
    availability: Availability;
    sizes: Size[];
    sizeFacetValue: string;
    isReplenishment: boolean;
    associatedAttributes: any[];
}

export interface Size {
    id: number;
    value: string;
    name?: string;
}

export interface Availability {
    isOnlineAvailable: boolean;
    isOfflineAvailable: boolean;
}
