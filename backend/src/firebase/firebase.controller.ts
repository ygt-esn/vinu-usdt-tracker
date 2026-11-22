import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Controller('notifications')
export class FirebaseController {
  constructor(private readonly firebaseService: FirebaseService) {}

  @Post('subscribe')
  async subscribe(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('FCM token zorunludur.');
    }
    await this.firebaseService.subscribeToTopic(token);
    return { success: true, message: 'Topic aboneliği başarılı.' };
  }
}