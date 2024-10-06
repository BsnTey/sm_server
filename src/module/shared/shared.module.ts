import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { HttpService } from '../http/http.service';

@Module({
    providers: [FileService, HttpService],
})
export class SharedModule {}
