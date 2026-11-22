import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Frontend tarafının /notifications/subscribe endpoint'ine erişebilmesi için bu kısım önemli.
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend çalışıyor: http://localhost:${port}`);
}
bootstrap();