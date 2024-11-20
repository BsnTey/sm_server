import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CourseWithLessons } from './interfaces/course.interface';
import { CourseStatus, LessonStatus } from '@prisma/client';

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

    async createAccountLessonProgress(accountId: string, course: CourseWithLessons): Promise<void> {
        const lessonProgressData = course.lessons.map(lesson => ({
            accountId,
            lessonId: lesson.lessonId,
            nextViewAt: null,
        }));

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

    async unBlockCourse(accountCourseId: number) {
        await this.prisma.accountCourse.update({
            where: {
                accountCourseId,
            },
            data: {
                status: CourseStatus.ACTIVE,
            },
        });
    }

    async finishCourse(accountCourseId: number) {
        await this.prisma.accountCourse.update({
            where: {
                accountCourseId,
            },
            data: {
                status: CourseStatus.FINISHED,
            },
        });
    }
}
