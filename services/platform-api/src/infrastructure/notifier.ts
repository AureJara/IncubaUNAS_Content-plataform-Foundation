import nodemailer, { type Transporter } from 'nodemailer';
import type { InvitationMessage, InvitationNotifier } from '../application/ports.js';

/**
 * Envía la invitación por SMTP (Mailpit en desarrollo). El cuerpo es texto plano a propósito: no hay
 * HTML que escapar ni contenido activo. El enlace lleva el token de un solo uso.
 */
export class SmtpInvitationNotifier implements InvitationNotifier {
  private readonly transporter: Transporter;

  constructor(
    options: { host: string; port: number; from: string; secure?: boolean },
    private readonly from = options.from,
  ) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure ?? false,
    });
  }

  async send(message: InvitationMessage): Promise<void> {
    const expires = message.expiresAt.toLocaleDateString(message.locale, { dateStyle: 'long' });
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      // El nombre lo elige el usuario: sin caracteres de control, para que no pueda alterar los headers del correo.
      subject: `Te invitaron a ${message.organizationName.replace(/\p{Cc}/gu, ' ')} en IncubaUNAS`,
      text: [
        `Te invitaron a unirte a ${message.organizationName}.`,
        '',
        `Acepta la invitación aquí (vence el ${expires}):`,
        message.acceptUrl,
        '',
        'Si no esperabas este mensaje, ignóralo: sin tu aceptación no pasa nada.',
      ].join('\n'),
    });
  }
}

/** Notificador para pruebas: guarda los mensajes en memoria. */
export class InMemoryInvitationNotifier implements InvitationNotifier {
  readonly sent: InvitationMessage[] = [];

  async send(message: InvitationMessage): Promise<void> {
    this.sent.push(message);
  }
}
