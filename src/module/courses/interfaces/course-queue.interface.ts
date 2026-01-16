export enum FlowJobType {
    DECIDE_NEXT = 'DECIDE_NEXT', // Решает, что делать
    WATCH_LESSON = 'WATCH_LESSON', // Смотрит конкретный урок
    PASS_TEST = 'PASS_TEST', // Сдает тест
    FINISH = 'FINISH', // Завершает флоу
}

export interface BaseFlowPayload {
    accountId: string;
    telegramId?: string;
    courseIds: number[];
    skipTests: boolean;
}

export interface WatchLessonPayload extends BaseFlowPayload {
    currentCourseId: number;
    lessonId: string;
    mnemocode: string;
    duration: number;
    lessonTitle: string;
}

export interface PassTestPayload extends BaseFlowPayload {
    currentCourseId: number;
    mnemocode: string;
}

export type CourseFlowPayload =
    | ({ type: FlowJobType.DECIDE_NEXT } & BaseFlowPayload)
    | ({ type: FlowJobType.WATCH_LESSON } & WatchLessonPayload)
    | ({ type: FlowJobType.PASS_TEST } & PassTestPayload)
    | ({ type: FlowJobType.FINISH } & BaseFlowPayload);
