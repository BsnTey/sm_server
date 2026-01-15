import { Module } from '@nestjs/common';
import { WebAppController } from './webapp.controller';
import { MirrorModule } from '../mirror/mirror.module';

@Module({
    imports: [MirrorModule],
    controllers: [WebAppController],
    exports: [],
})
export class WebappModule {}
