import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const smtpMock = vi.hoisted(() => ({
  createTransport: vi.fn(),
  verify: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: smtpMock.createTransport },
}));

import { sendEmailResult } from './mailer';

const SMTP_ENV_KEYS = [
  'EMAIL_HOST', 'EMAIL_SERVER', 'SMTP_HOST', 'MAIL_HOST',
  'EMAIL_PORT', 'SMTP_PORT', 'MAIL_PORT',
  'EMAIL_USER', 'SMTP_USER', 'MAIL_USER',
  'EMAIL_PASS', 'EMAIL_PASSWORD', 'SMTP_PASS', 'SMTP_PASSWORD', 'MAIL_PASS', 'MAIL_PASSWORD',
  'EMAIL_FROM', 'SMTP_FROM', 'MAIL_FROM', 'EMAIL_FROM_NAME',
] as const;

const originalEnv = Object.fromEntries(SMTP_ENV_KEYS.map((key) => [key, process.env[key]]));

describe('sendEmailResult SMTP-Konfiguration', () => {
  beforeEach(() => {
    for (const key of SMTP_ENV_KEYS) delete process.env[key];
    smtpMock.verify.mockReset().mockResolvedValue(true);
    smtpMock.sendMail.mockReset().mockResolvedValue({ messageId: 'test-message' });
    smtpMock.createTransport.mockReset().mockReturnValue({
      verify: smtpMock.verify,
      sendMail: smtpMock.sendMail,
    });
  });

  afterEach(() => {
    for (const key of SMTP_ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('trennt SMTP-Login vom sichtbaren Absender', async () => {
    process.env.EMAIL_HOST = 'smtp.example.de';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'smtp-login@example.de';
    process.env.EMAIL_PASS = 'secret';
    process.env.EMAIL_FROM = 'Gleistrix Team <mailer@example.de>';

    const result = await sendEmailResult({
      to: 'recipient@example.de',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result).toEqual({ ok: true });
    expect(smtpMock.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.de',
      port: 587,
      secure: false,
      auth: { user: 'smtp-login@example.de', pass: 'secret' },
    }));
    expect(smtpMock.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Gleistrix Team <mailer@example.de>',
      to: 'recipient@example.de',
    }));
  });

  test('unterstützt die üblichen SMTP_-Variablennamen', async () => {
    process.env.SMTP_HOST = 'smtp.example.de';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'smtp@example.de';
    process.env.SMTP_PASSWORD = 'secret';

    const result = await sendEmailResult({ to: 'recipient@example.de', subject: 'Test', html: 'Test' });

    expect(result.ok).toBe(true);
    expect(smtpMock.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      secure: true,
      auth: { user: 'smtp@example.de', pass: 'secret' },
    }));
  });
});
