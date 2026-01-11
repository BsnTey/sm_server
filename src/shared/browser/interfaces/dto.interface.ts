export interface InputBrowserData {
    url: string;
    proxy?: string;
    targetCookie: string;
    inputCookies?: Record<string, string>;
}
export interface BrowserSessionSuccess {
    success: true;
    cookieValue: string | null;
    userAgent: string;
    /**
     * Объект всех кук со страницы (ключ: имя куки, значение: значение куки)
     */
    allCookies: Record<string, string>;
}
export interface BrowserSessionError {
    success: false;
    /**
     * Текст ошибки, если что-то пошло не так
     */
    error: string;
}
export type BrowserSessionResult = BrowserSessionSuccess | BrowserSessionError;