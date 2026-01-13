export enum CardLevel {
    STANDART = 'STANDART',
    STANDARD = 'STANDARD', //в веб версии так
    SILVER = 'SILVER', // x1.5
    GOLD = 'GOLD', // x2
}

export enum CourseStatus {
    ACTIVE = 'ACTIVE',
    NONE = 'NONE',
    FINISHED = 'FINISHED',
}

export interface CourseStats {
    countLessons: number;
    countLessonsLearned: number;
}

export interface CourseItem {
    id: number;
    title: string;
    points: number;
    stats: CourseStats;
    status: CourseStatus | string;
}

export interface CoursesResponse {
    list: CourseItem[];
}

export interface PointsCalculationResult {
    totalEarned: number; // Всего можно забрать сейчас
    totalFuture: number; // Будущий потенциал
    earnedCourses: number[]; // Массив баллов готовых курсов (уже умноженных) для генерации кнопок
}

export interface CourseAnalyticsResult extends PointsCalculationResult {
    courseList: CourseItem[];
    cardLevel: CardLevel;
}
