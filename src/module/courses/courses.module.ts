import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CourseWorkService } from './courses.service';

@Module({
    imports: [AccountModule],
    providers: [CourseWorkService],
    exports: [CourseWorkService],
})
export class CourseModule {}
