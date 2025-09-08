export interface Address {
    unstructuredAddress: string;
    postalCode: string;
    countryCode: string;
    coder: string;
    yandexStructureComponentList: YandexStructureComponentList[];
    geoPoint: GeoPointLon;
}

export interface GeoPointLon {
    lat: number;
    lon: number;
}

export interface GeoPointLng {
    lat: number;
    lng: number;
}

export interface YandexStructureComponentList {
    kind: string;
    name: string;
    num: number;
}

export interface DataCoord {
    city: City;
    location: Location;
    locationUpdate: string;
    locationAvailability: LocationAvailability;
}

export interface LocationAvailability {
    availableForHeader: boolean;
    requiredLayers: boolean;
    availableForApp: boolean;
}

export interface Location {
    geoPoint: GeoPointLon;
    geoFences: GeoFence[];
    locationName: string;
    locationLevel: string;
    isConfirmed: boolean;
    availabilityCluster: string;
}

export interface GeoFence {
    geoFenceId: string;
    geoFenceName: string;
    territoryId?: string;
    geoLayer: GeoLayer;
}

export interface GeoLayer {
    geoLayerId: string;
    geoLayerCode: string;
}

export interface City {
    id: string;
    name: string;
    eutc: string;
    macrocityId: string;
    hasMetro: boolean;
}

export interface DataAddress {
    location: Location;
    address: Address;
    locationUpdate: string;
    locationAvailability: LocationAvailability;
}
