import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CourseWithLessons } from './interfaces/course.interface';
import { CourseStatus, Lesson, LessonStatus } from '@prisma/client';

@Injectable()
export class CourseRepository {
    constructor(private prisma: PrismaService) {}

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
            const isFirstLesson = ['1321', '621', '662', '681', '821', '842', '861', '961', '981'].includes(lesson.lessonId);
            const courseStatus = isFirstLesson ? LessonStatus.NONE : LessonStatus.BLOCKED;
            return {
                status: courseStatus,
                accountId,
                lessonId: lesson.lessonId,
                nextViewAt: null,
            };
        });

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

    async updateViewedLesson(progressId: number) {
        return this.prisma.accountLessonProgress.update({
            where: {
                progressId,
            },
            data: {
                status: LessonStatus.VIEWED,
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
}
