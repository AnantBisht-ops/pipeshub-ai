import { Container } from 'inversify';
import { NotificationService } from '../service/notification.service';
import { Logger } from '../../../libs/services/logger.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AppConfig } from '../../tokens_manager/config/config';
import { TYPES } from '../../../libs/types/container.types';
import { NotificationProducer } from '../service/notification.producer';
import { NotificationConsumer } from '../service/notification.consumer';

export class NotificationContainer {
  private static container: Container | null = null;

  static async initialize(appConfig: AppConfig): Promise<Container> {
    const container = new Container();
    const logger = new Logger({ service: 'NotificationService' });
    container.bind<Logger>('Logger').toConstantValue(logger);

    const authTokenService = new AuthTokenService(
      appConfig.jwtSecret,
      appConfig.scopedJwtSecret,
    );
    container.bind<AuthTokenService>(TYPES.AuthTokenService).toConstantValue(authTokenService);

    const notificationService = new NotificationService(authTokenService);
    container.bind(NotificationService).toConstantValue(notificationService);

    const notificationProducer = new NotificationProducer(appConfig.kafka, logger);
    container.bind(NotificationProducer).toConstantValue(notificationProducer);

    const notificationConsumer = new NotificationConsumer(appConfig.kafka, logger);
    container.bind(NotificationConsumer).toConstantValue(notificationConsumer);

    this.container = container;
    return container;
  }

  static async dispose(): Promise<void> {
    if (this.container) {
      this.container.unbindAll();
    }
  }
}