/**
 * Email transports. Production uses Amazon SES (EMAIL_TRANSPORT=ses); local work uses "console" (prints, sends nothing);
 * "off" drops mail silently. The SES client reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION from the environment
 * (or the server's IAM role), so no key is ever in the code.
 */
export type Attachment = { filename: string; contentType: string; content: Buffer };
export type OutgoingEmail = { to: string; subject: string; html: string; text: string; attachments?: Attachment[]; headers?: Record<string, string> };
export type SendResult = { messageId: string };
export interface EmailTransport { send(message: OutgoingEmail): Promise<SendResult> }

/** A permanent failure (bad address, rejected content): retrying will never help. */
export class PermanentEmailError extends Error {}

export function emailSettings(env: Record<string, string | undefined> = process.env) {
  return {
    transport: (env.EMAIL_TRANSPORT || (env.AWS_ACCESS_KEY_ID || env.AWS_ROLE_ARN ? "ses" : "console")).toLowerCase(),
    region: env.AWS_REGION || env.SES_REGION || "ap-south-1",
    from: env.EMAIL_FROM || "Sheplates <no-reply@sheplates.com>",
    replyTo: env.EMAIL_REPLY_TO || "support@sheplates.com",
    configurationSet: env.SES_CONFIGURATION_SET || "",
  };
}

const encodeWord = (value: string) => (/^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`);
const wrap76 = (b64: string) => b64.replace(/.{76}/g, "$&\r\n");
const cleanHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const addressOnly = (value: string) => (value.match(/<([^>]+)>/)?.[1] || value).trim();

/** Builds a raw MIME message (needed because SES "simple" mail cannot carry attachments). Header values cannot inject new headers. */
export function buildRawMime(message: OutgoingEmail, from: string, replyTo: string): string {
  const mixed = `=_mixed_${Math.random().toString(36).slice(2)}`;
  const alt = `=_alt_${Math.random().toString(36).slice(2)}`;
  const display = from.match(/^(.*)<[^>]+>$/)?.[1]?.trim().replace(/^"|"$/g, "");
  const head = [
    `From: ${display ? `${encodeWord(cleanHeader(display))} <${addressOnly(from)}>` : addressOnly(from)}`,
    `To: ${cleanHeader(message.to)}`,
    `Reply-To: ${cleanHeader(replyTo)}`,
    `Subject: ${encodeWord(cleanHeader(message.subject))}`,
    "MIME-Version: 1.0",
    ...Object.entries(message.headers || {}).map(([k, v]) => `${cleanHeader(k)}: ${cleanHeader(v)}`),
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
  ];
  const body = [
    `--${mixed}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "",
    `--${alt}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap76(Buffer.from(message.text, "utf8").toString("base64")),
    `--${alt}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrap76(Buffer.from(message.html, "utf8").toString("base64")),
    `--${alt}--`,
  ];
  for (const file of message.attachments || []) {
    const name = cleanHeader(file.filename).replace(/"/g, "");
    body.push(`--${mixed}`, `Content-Type: ${cleanHeader(file.contentType)}; name="${name}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${name}"`, "", wrap76(file.content.toString("base64")));
  }
  body.push(`--${mixed}--`, "");
  return `${head.join("\r\n")}\r\n\r\n${body.join("\r\n")}`;
}

class ConsoleTransport implements EmailTransport {
  async send(message: OutgoingEmail) { console.info(`[email:console] to=${message.to} subject=${message.subject} attachments=${message.attachments?.length || 0}`); return { messageId: `console-${Date.now()}` }; }
}
class OffTransport implements EmailTransport { async send() { return { messageId: "off" }; } }

class SesTransport implements EmailTransport {
  private client: unknown;
  private settings = emailSettings();
  async send(message: OutgoingEmail): Promise<SendResult> {
    const sdk = await import("@aws-sdk/client-sesv2");
    this.client ||= new sdk.SESv2Client({ region: this.settings.region });
    const client = this.client as InstanceType<typeof sdk.SESv2Client>;
    const configurationSetName = this.settings.configurationSet || undefined;
    try {
      const content = message.attachments?.length
        ? { Raw: { Data: Buffer.from(buildRawMime(message, this.settings.from, this.settings.replyTo), "utf8") } }
        : { Simple: { Subject: { Data: message.subject, Charset: "UTF-8" }, Body: { Html: { Data: message.html, Charset: "UTF-8" }, Text: { Data: message.text, Charset: "UTF-8" } } } };
      const result = await client.send(new sdk.SendEmailCommand({ FromEmailAddress: this.settings.from, Destination: { ToAddresses: [message.to] }, ReplyToAddresses: [this.settings.replyTo], ConfigurationSetName: configurationSetName, Content: content }));
      return { messageId: result.MessageId || "" };
    } catch (error) {
      const name = (error as { name?: string })?.name || "";
      if (["MessageRejected", "BadRequestException", "InvalidParameterValue", "AccountSuspendedException", "MailFromDomainNotVerifiedException", "NotFoundException"].includes(name)) throw new PermanentEmailError(`${name}: ${(error as Error).message}`);
      throw error; // throttling, network, 5xx: the outbox retries these
    }
  }
}

let cached: EmailTransport | null = null;
export function getTransport(): EmailTransport {
  if (cached) return cached;
  const kind = emailSettings().transport;
  cached = kind === "ses" ? new SesTransport() : kind === "off" ? new OffTransport() : new ConsoleTransport();
  return cached;
}
export function setTransportForTests(transport: EmailTransport | null) { cached = transport; }
