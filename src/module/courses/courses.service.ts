import { Injectable, Logger } from '@nestjs/common';
import { AccountService } from '../account/account.service';

@Injectable()
export class CourseWorkService {
    private readonly logger = new Logger(CourseWorkService.name);

    constructor(private accountService: AccountService) {}

    async getCoursesByAccountId(accountId: string) {
        let response;
        try {
            response = await this.accountService.getCourses(accountId);
        } catch {
            throw new Error('Ошибка получения данных');
        }

        const mapedCourse: string[] = [];
        response.list.forEach(course => mapedCourse.push(`Название: ${course.title}\nСтатус: ${course.status}\n`));

        return mapedCourse.join('\n');
    }
}
