import { AccountCourse, AccountLessonProgress, Lesson, OriginalCourse } from '@prisma/client';

export interface CourseWithLessons extends OriginalCourse {
    lessons: Lesson[];
}

export interface IAccountCourse {
    accountId: string;
    statusCourse: string;
    AccountCourse: IAccountCourseWLesson[];
}

export interface ICourseWLesson extends OriginalCourse {
    lessons: IAccountCourseWProgress[];
}

export interface IAccountCourseWLesson extends AccountCourse {
    course: ICourseWLesson;
}

export interface IAccountCourseWProgress extends Lesson {
    AccountLessonProgress: AccountLessonProgress[];
}

export interface IWatchLesson {
    mnemocode: string;
    videoId: string;
    lessonId: string;
    duration: number;
}
