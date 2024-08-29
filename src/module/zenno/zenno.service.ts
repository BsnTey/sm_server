import { Injectable } from '@nestjs/common';
import { ZennoRepository } from './zenno.repository';
import { ZennoConfigDto } from './dto/config.dto';

@Injectable()
export class ZennoService {
    constructor(private zennoRepository: ZennoRepository) {}

    async updateZennoConfig(dto: ZennoConfigDto): Promise<ZennoConfigDto> {
        const { mobile } = dto;
        //cделать проверку на уникальное значение задания

        for (const easyItem of mobile.easy) {
            await this.zennoRepository.updateTodoActive(easyItem.todo, easyItem.active);
        }

        for (const heavyItem of mobile.heavy) {
            await this.zennoRepository.updateTodoActive(heavyItem.todo, heavyItem.active);

            for (const course of heavyItem.courses) {
                await this.zennoRepository.updateCourseActive(course.name, course.active);
            }
        }

        return await this.getZennoConfig();
    }

    async getZennoConfig(): Promise<ZennoConfigDto> {
        const todos = await this.zennoRepository.getTodos();
        const coursesDB = await this.zennoRepository.getCourses();

        const todosFilters = todos.map(todo => ({
            todo: todo.todo,
            name: todo.name,
            active: todo.active,
        }));

        const easy = todosFilters.filter(todo => todo.todo !== 'course');

        const courses = coursesDB.map(todo => {
            return {
                id: todo.id,
                name: todo.name,
                active: todo.active,
                count: todo.count,
            };
        });

        const heavy = todosFilters
            .filter(todo => todo.todo === 'course')
            .map(todo => {
                if (todo.todo === 'course') {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    todo['courses'] = courses;
                }
                return todo;
            });

        return {
            mobile: {
                easy,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                heavy,
            },
        };
    }
}
