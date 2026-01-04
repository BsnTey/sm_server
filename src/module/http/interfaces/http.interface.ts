export interface HeaderPackage {
    headers: Record<string, string>;
    tlsClientIdentifier: string;
}

export interface HttpOptions extends HeaderPackage {
    proxy: string | undefined;
}
