import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { Course, Todo } from '@prisma/client';

@Injectable()
export class ZennoRepository {
    constructor(private readonly prisma: PrismaService) {}

    async updateTodoActive(todo: string, active: boolean): Promise<void> {
        await this.prisma.todo.update({
            where: { todo },
            data: { active },
        });
    }

    async updateCourseActive(name: string, active: boolean): Promise<void> {
        await this.prisma.course.update({
            where: { name },
            data: { active },
        });
    }

    async getTodos(): Promise<Todo[]> {
        return this.prisma.todo.findMany();
    }

    async getCourses(): Promise<Course[]> {
        return this.prisma.course.findMany();
    }

    async setActiveTodoById(activeTodoId?: string): Promise<void> {
        const ops = [];
        ops.push(
            this.prisma.todo.updateMany({
                where: {},
                data: { active: false },
            }),
        );

        if (activeTodoId) {
            ops.push(
                this.prisma.todo.updateMany({
                    where: { todo: activeTodoId },
                    data: { active: true },
                }),
            );
        }

        await this.prisma.$transaction(ops);
    }

    async updateCoursesActiveBulk(courses: { name: string; active: boolean }[]): Promise<void> {
        if (!courses || courses.length === 0) return;

        const namesTrue = courses.filter(c => c.active).map(c => c.name);
        const namesFalse = courses.filter(c => !c.active).map(c => c.name);

        const ops = [];

        if (namesTrue.length > 0) {
            ops.push(
                this.prisma.course.updateMany({
                    where: { name: { in: namesTrue } },
                    data: { active: true },
                }),
            );
        }

        if (namesFalse.length > 0) {
            ops.push(
                this.prisma.course.updateMany({
                    where: { name: { in: namesFalse } },
                    data: { active: false },
                }),
            );
        }
        if (ops.length === 0) return;

        await this.prisma.$transaction(ops);
    }
}
