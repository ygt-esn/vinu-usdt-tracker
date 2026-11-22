import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as path from 'path';

export interface TransferNotificationPayload {
  from: string;
  to: string;
  amount: string;
  txHash: string;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private readonly registeredTokens = new Set<string>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (getApps().length === 0) {
      const relativePath = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT_PATH',
        './firebase-service-account.json',
      );
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

      initializeApp({
        credential: cert(serviceAccount),
      });
      this.logger.log('Firebase Admin SDK başarıyla başlatıldı.');
    }
  }

  async subscribeToTopic(token: string) {
    this.registeredTokens.add(token);
    this.logger.log(
      `Device token kaydedildi. Aktif istemci sayısı: ${this.registeredTokens.size}`,
    );
    return { registered: true, activeClients: this.registeredTokens.size };
  }

  async sendTransferNotification(payload: TransferNotificationPayload) {
    if (this.registeredTokens.size === 0) {
      this.logger.warn('Kayıtlı cihaz tokenı yok, bildirim atlandı.');
      return;
    }

    const formattedAmount = Number(payload.amount).toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });

    const tokens = Array.from(this.registeredTokens);

    const message: MulticastMessage = {
      tokens,
      notification: {
        title: `Büyük USDT Transferi: ${formattedAmount} USDT`,
        body: `Gönderen: ${payload.from.slice(0, 8)}... → Alıcı: ${payload.to.slice(0, 8)}...`,
      },
      data: {
        fromAddress: payload.from,
        toAddress: payload.to,
        amount: payload.amount,
        txHash: payload.txHash,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);
      this.logger.log(
        `FCM bildirimi gönderildi. Başarılı: ${response.successCount}, Başarısız: ${response.failureCount}`,
      );

      // Geçersiz veya süresi dolmuş token'ları otomatik temizliyoruz
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.registeredTokens.delete(tokens[idx]);
          }
        });
      }
    } catch (error) {
      this.logger.error('FCM bildirimi gönderilemedi:', error);
    }
  }
}