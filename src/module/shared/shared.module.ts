import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { HttpModule } from '../http/http.module';

@Module({
    providers: [FileService],
    exports: [FileService],
    imports: [HttpModule],
})
export class SharedModule {}
