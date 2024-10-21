export interface ISearchByTelegramId {
    results: Result[];
}

export interface Result {
    id: string;
    text: string;
}

export type Html = string;
