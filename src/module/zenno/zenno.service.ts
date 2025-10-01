import { Injectable } from '@nestjs/common';
import { ZennoRepository } from './zenno.repository';
import { ZennoConfigDtoV2 } from './dto/configV2.dto';

@Injectable()
export class ZennoService {
    constructor(private zennoRepository: ZennoRepository) {}

    async updateZennoConfigV2({ config }: ZennoConfigDtoV2) {
        await this.zennoRepository.setActiveTodoById(config.activeId);

        await this.zennoRepository.updateCoursesActiveBulk(config.courses);

        return this.getZennoConfigV2();
    }

    async getZennoConfigV2() {
        const [todos, coursesDB] = await Promise.all([this.zennoRepository.getTodos(), this.zennoRepository.getCourses()]);

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
