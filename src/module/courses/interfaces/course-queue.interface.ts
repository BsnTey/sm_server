export interface CourseViewingPayload {
    accountId: string;
    telegramId: string; // Чтобы уведомить в конце
    courseIds: number[]; // Список курсов, которые осталось пройти
    currentCourseId?: number; // Курс, который сейчас в работе
    skipTests: boolean;
    skipNotifiy: boolean;
}
