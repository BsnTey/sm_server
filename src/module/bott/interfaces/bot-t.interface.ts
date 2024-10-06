export interface ISearchByTelegramId {
    results: Result[];
}

export interface Result {
    id: string;
    text: string;
}

export type HtmlWCsrfToken = string;
