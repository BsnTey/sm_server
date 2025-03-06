import { Injectable } from '@nestjs/common';
import { ZennoRepository } from './zenno.repository';
import { ZennoConfigDto } from './dto/config.dto';
import { ZennoConfigDtoV2 } from './dto/configV2.dto';

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

    async updateZennoConfigV2({ config }: ZennoConfigDtoV2) {
        const configFromDB = await this.getZennoConfigV2();
        const currentTodo = configFromDB.data.features.find(todo => todo.active);
        if (currentTodo?.id !== config.activeId) {
            for (const feature of configFromDB.data.features) {
                const active = feature.id === config.activeId;
                await this.zennoRepository.updateTodoActive(feature.id, active);
            }
        }

        for (const course of config.courses) {
            await this.zennoRepository.updateCourseActive(course.name, course.active);
        }

        return await this.getZennoConfigV2();
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

    async getZennoConfigV2() {
        const todos = await this.zennoRepository.getTodos();
        const coursesDB = await this.zennoRepository.getCourses();

        const todosMap = todos.map(todo => ({
            id: todo.todo,
            name: todo.name,
            active: todo.active,
        }));

        const courses = coursesDB.map(todo => {
            return {
                id: todo.id,
                name: todo.name,
                active: todo.active,
                count: todo.count,
            };
        });

        return {
            data: {
                features: todosMap,
                configs: {
                    courses,
                },
            },
        };
    }
}
