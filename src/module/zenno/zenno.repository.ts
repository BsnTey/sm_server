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
}
