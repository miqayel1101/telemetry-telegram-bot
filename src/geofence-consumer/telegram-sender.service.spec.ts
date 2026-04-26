import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { Telegraf } from 'telegraf';
import {
  TelegramSenderService,
  TelegramForbiddenError,
  TelegramSendExhaustedError,
} from './telegram-sender.service';
import { FormattedAlert } from './interfaces';

const INJECT_BOT_TOKEN = 'DEFAULT_BOT_NAME';

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};

function makeAlert(): FormattedAlert {
  return {
    text: '<b>Alert</b>',
    parseMode: 'HTML',
    inlineKeyboard: [[{ text: 'Location', callback_data: 'loc:1' }]],
  };
}

function makeMockBot(sendMessageImpl: jest.Mock) {
  return {
    telegram: {
      sendMessage: sendMessageImpl,
    },
  } as unknown as Telegraf;
}

async function buildService(
  sendMessageImpl: jest.Mock,
): Promise<TelegramSenderService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      TelegramSenderService,
      { provide: INJECT_BOT_TOKEN, useValue: makeMockBot(sendMessageImpl) },
      { provide: Logger, useValue: mockLogger },
    ],
  }).compile();

  return module.get<TelegramSenderService>(TelegramSenderService);
}

describe('TelegramSenderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('send()', () => {
    it('returns telegramMessageId on success', async () => {
      const sendMessage = jest.fn().mockResolvedValue({ message_id: 999 });
      const service = await buildService(sendMessage);

      const result = await service.send('-100123', makeAlert());

      expect(result.telegramMessageId).toBe('999');
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith(
        '-100123',
        '<b>Alert</b>',
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('throws TelegramForbiddenError on 403', async () => {
      const sendMessage = jest.fn().mockRejectedValue({
        code: 403,
        description: 'Forbidden: bot was kicked',
      });
      const service = await buildService(sendMessage);

      await expect(service.send('-100123', makeAlert())).rejects.toThrow(
        TelegramForbiddenError,
      );
    });

    it('throws TelegramSendExhaustedError after 3 retries on persistent non-429 error', async () => {
      jest.useFakeTimers();
      const sendMessage = jest.fn().mockRejectedValue({
        code: 500,
        description: 'Internal Server Error',
      });
      const service = await buildService(sendMessage);

      const promise = service.send('-100123', makeAlert());

      // Advance timers for each retry sleep (1s, 2s, 3s)
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(5000);
      }

      await expect(promise).rejects.toThrow(TelegramSendExhaustedError);
      expect(sendMessage).toHaveBeenCalledTimes(4); // initial + 3 retries
      jest.useRealTimers();
    }, 15000);

    it('throws TelegramSendExhaustedError after 3 retries on 429', async () => {
      jest.useFakeTimers();
      const sendMessage = jest.fn().mockRejectedValue({
        code: 429,
        description: 'Too Many Requests',
        parameters: { retry_after: 1 },
      });
      const service = await buildService(sendMessage);

      const promise = service.send('-100123', makeAlert());

      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(5000);
      }

      await expect(promise).rejects.toThrow(TelegramSendExhaustedError);
      expect(sendMessage).toHaveBeenCalledTimes(4); // initial + 3 retries
      jest.useRealTimers();
    }, 15000);

    it('uses separate per-chat queues (same chatId goes through same queue)', async () => {
      const sendMessage = jest
        .fn()
        .mockResolvedValueOnce({ message_id: 1 })
        .mockResolvedValueOnce({ message_id: 2 });
      const service = await buildService(sendMessage);

      const [r1, r2] = await Promise.all([
        service.send('-111', makeAlert()),
        service.send('-111', makeAlert()),
      ]);

      expect(r1.telegramMessageId).toBe('1');
      expect(r2.telegramMessageId).toBe('2');
    });

    it('calls sendMessage with correct inline_keyboard', async () => {
      const sendMessage = jest.fn().mockResolvedValue({ message_id: 5 });
      const service = await buildService(sendMessage);
      const alert: FormattedAlert = {
        text: 'Test',
        parseMode: 'HTML',
        inlineKeyboard: [[{ text: 'Loc', callback_data: 'loc:7' }]],
      };

      await service.send('-100', alert);

      expect(sendMessage).toHaveBeenCalledWith(
        '-100',
        'Test',
        expect.objectContaining({
          reply_markup: {
            inline_keyboard: [[{ text: 'Loc', callback_data: 'loc:7' }]],
          },
        }),
      );
    });

    it('uses default retry_after of 5 when parameters field is missing', async () => {
      jest.useFakeTimers();
      const sendMessage = jest
        .fn()
        .mockRejectedValueOnce({ code: 429, description: 'Rate limited' })
        .mockResolvedValue({ message_id: 10 });
      const service = await buildService(sendMessage);

      const promise = service.send('-100', makeAlert());

      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(6000);
      }

      const result = await promise;
      expect(result.telegramMessageId).toBe('10');
      jest.useRealTimers();
    }, 15000);
  });

  describe('onModuleDestroy()', () => {
    it('clears queues without throwing', async () => {
      const sendMessage = jest.fn().mockResolvedValue({ message_id: 1 });
      const service = await buildService(sendMessage);

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
