import { Body, Controller, HttpCode, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { CourseWorkService } from './courses.service';
import { CourseWorkerApiRequestDto } from './dto/courses-worker.dto';
import { HasZenno } from '@common/decorators/zenno.decorator';

@Controller('courses')
export class CoursesController {
    constructor(private readonly courseWorkService: CourseWorkService) {}

    @HasZenno()
    @Post('process-list')
    @HttpCode(200)
    async processSpecificList(@Body() dto: CourseWorkerApiRequestDto) {
        const { accountId, courseIds } = dto;

        const count = await this.courseWorkService.queueSpecificCourses(accountId, courseIds);

        return {
            success: true,
            message: `В очередь добавлено ${count} курсов`,
            courseIds,
        };
    }
}