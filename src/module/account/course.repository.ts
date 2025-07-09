import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CourseWithLessons } from './interfaces/course.interface';
import { AccountCourse, CourseStatus, Lesson, LessonStatus } from '@prisma/client';
import { LessonProgressData } from './interfaces/lesson-progress.interface';

@Injectable()
export class CourseRepository {
    firstLessons: string[] = [];

    constructor(private prisma: PrismaService) {
        this.loadFirstLessons();
    }

    async loadFirstLessons() {
        const firstLessons = await this.prisma.lesson.findMany({
            where: {
                position: 1,
            },
        });
        this.firstLessons = firstLessons.map(lesson => lesson.lessonId);
    }

    async createAccountCourse(accountId: string, course: CourseWithLessons): Promise<void> {
        await this.prisma.accountCourse.create({
            data: {
                accountId,
                courseId: course.courseId,
            },
        });
    }

    async getAllLesson(): Promise<Lesson[]> {
        return this.prisma.lesson.findMany();
    }

    async createAccountLessonProgress(accountId: string, lessons: Lesson[]): Promise<void> {
        const lessonProgressData = lessons.map(lesson => {
            return {
                accountId,
                accountCourseAccountCourseId: +lesson.courseId,
                lessonId: lesson.lessonId,
                nextViewAt: null,
            };
        });

        await this.prisma.accountLessonProgress.createMany({
            data: lessonProgressData,
        });
    }

    async createAccountLessonProgressByExistCourses(lessonProgressData: LessonProgressData[]): Promise<void> {
        await this.prisma.accountLessonProgress.createMany({
            data: lessonProgressData,
        });
    }

    async getCoursesWithLessons(): Promise<CourseWithLessons[]> {
        return this.prisma.originalCourse.findMany({
            include: {
                lessons: {
                    orderBy: {
                        position: 'asc',
                    },
                },
            },
        });
    }

    async getLessonsWithProgressByAccountAndCourse(accountId: string, courseId: string) {
        const lessons = await this.prisma.lesson.findMany({
            where: {
                courseId: courseId,
            },
            include: {
                AccountLessonProgress: {
                    where: {
                        accountId: accountId,
                    },
                },
            },
            orderBy: {
                position: 'asc',
            },
        });

        return lessons.map(lesson => {
            const progress = lesson.AccountLessonProgress[0];

            return {
                ...lesson,
                progress,
            };
        });
    }

    async getFirstLessonProgressId(accountId: string, courseId: string): Promise<number | null> {
        const firstLesson = await this.prisma.lesson.findFirst({
            where: {
                courseId,
                position: 1,
            },
            include: {
                AccountLessonProgress: {
                    where: {
                        accountId,
                    },
                },
            },
        });

        if (!firstLesson || firstLesson.AccountLessonProgress.length === 0) {
            return null;
        }

        return firstLesson.AccountLessonProgress[0].progressId;
    }

    async getCoursesByAccountAndStatus(accountId: string, status: CourseStatus): Promise<AccountCourse[]> {
        return this.prisma.accountCourse.findMany({
            where: {
                accountId,
                status,
            },
            orderBy: {
                courseId: 'asc',
            },
        });
    }

    async updateViewLesson(progressId: number, status: LessonStatus) {
        return this.prisma.accountLessonProgress.update({
            where: {
                progressId,
            },
            data: {
                status,
            },
        });
    }

    async updateUnblockLesson(progressId: number, timeUnblock: Date) {
        await this.prisma.accountLessonProgress.update({
            where: {
                progressId,
            },
            data: {
                status: LessonStatus.NONE,
                nextViewAt: timeUnblock,
            },
        });
    }

    async changeStatusCourse(accountId: string, courseId: string, status: CourseStatus) {
        await this.prisma.accountCourse.update({
            where: {
                accountId_courseId: {
                    accountId,
                    courseId,
                },
            },
            data: {
                status,
            },
        });
    }

    async changeStatusLesson(accountId: string, lessonId: string, status: LessonStatus) {
        await this.prisma.accountLessonProgress.update({
            where: {
                accountId_lessonId: {
                    accountId,
                    lessonId,
                },
            },
            data: {
                status,
            },
        });
    }

    async getAllAvailableCoursesId() {
        return this.prisma.originalCourse.findMany({
            select: {
                courseId: true,
            },
        });
    }

    async getIsAccountCourses(accountId: string) {
        return this.prisma.accountCourse.findMany({
            where: {
                accountId: accountId,
            },
            select: {
                courseId: true,
            },
        });
    }

    async getAllCoursesIdAndMnemocode(): Promise<{ courseId: string; mnemocode: string }[]> {
        return this.prisma.originalCourse.findMany({
            select: {
                courseId: true,
                mnemocode: true,
            },
        });
    }

    async getAccountCoursesByAccountId(accountId: string) {
        return this.prisma.accountCourse.findMany({
            where: {
                accountId: accountId,
            },
        });
    }
}
