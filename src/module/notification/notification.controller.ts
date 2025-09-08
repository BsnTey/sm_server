import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { UpdatingPreferenceStatusRequestDto } from './dto/update-preference-status.dto';
import { NotificationService } from './notification.service';
import { StartOrderTrackingRequestDto, StartOrderTrackingResponseDto } from './dto/start-order-tracking.dto';

@Controller('notification')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @Get(':tgId/preferences')
    @HttpCode(200)
    async getPreferences(@Param('tgId') tgId: string) {
        return this.notificationService.getPreferences(tgId);
    }

    @Put(':tgId/preferences')
    @HttpCode(200)
    async updatePreferenceStatusOrder(@Body() dto: UpdatingPreferenceStatusRequestDto, @Param('tgId') tgId: string) {
        return this.notificationService.setPreferences(tgId, dto);
    }

    @Post('order/track')
    @HttpCode(202)
    async enqueueOrderTracking(@Body() dto: StartOrderTrackingRequestDto): Promise<StartOrderTrackingResponseDto> {
        return this.notificationService.startTracking(dto);
    }
}
