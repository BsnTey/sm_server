import { Course } from '../../account/interfaces/course-list.interface';

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

export interface PointsCalculationResult {
    totalEarned: number; // Всего можно забрать сейчас
    totalFuture: number; // Будущий потенциал
    earnedCourses: number[]; // Массив баллов готовых курсов (уже умноженных) для генерации кнопок
    futureCourses: number[]; // Баллы курсов для работы
}

export interface CourseAnalyticsResult extends PointsCalculationResult {
    courseList: Course[];
    cardLevel: CardLevel;
}
