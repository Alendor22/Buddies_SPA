import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hash, MetaError } from './security';

const id = z.string().regex(/^\d{1,40}$/);
const envelope = z.object({
  object: z.enum(['page', 'instagram', 'whatsapp_business_account']),
  entry: z.array(z.object({
    id,
    messaging: z.array(z.object({
      sender: z.object({ id }), recipient: z.object({ id }), timestamp: z.number().int().positive(),
      message: z.object({ mid: z.string().max(256), is_echo: z.boolean().optional(), text: z.string().max(10000).optional() }).passthrough().optional()
    }).passthrough()).max(1000).optional(),
    changes: z.array(z.object({ value: z.object({
      metadata: z.object({ phone_number_id: id }).optional(),
      messages: z.array(z.object({ from: id, id: z.string().max(256), timestamp: z.string().regex(/^\d+$/), text: z.object({ body: z.string().max(10000) }).optional() }).passthrough()).max(1000).optional()
    }).passthrough() }).passthrough()).max(1000).optional()
  }).passthrough()).max(1000)
});
export function inboundEvents(payload: unknown) {
  const parsed = envelope.safeParse(payload);
  if (!parsed.success) throw new MetaError(400, 'Invalid Meta webhook.');
  const events: { platform: string; asset: string; sender: string; at: Date; optOut: boolean }[] = [];
  for (const entry of parsed.data.entry) {
    if (parsed.data.object === 'whatsapp_business_account') {
      for (const change of entry.changes || []) {
        if (!change.value.metadata) continue;
        for (const message of change.value.messages || []) events.push({ platform: 'whatsapp', asset: change.value.metadata.phone_number_id, sender: message.from, at: new Date(Number(message.timestamp) * 1000), optOut: /^(stop|unsubscribe|cancel)$/i.test(message.text?.body?.trim() || '') });
      }
    } else {
      for (const message of entry.messaging || []) {
        if (!message.message || message.message.is_echo || message.recipient.id !== entry.id || message.sender.id === entry.id) continue;
        events.push({ platform: parsed.data.object === 'page' ? 'facebook' : 'instagram', asset: entry.id, sender: message.sender.id, at: new Date(message.timestamp), optOut: /^(stop|unsubscribe|cancel)$/i.test(message.message.text?.trim() || '') });
      }
    }
  }
  return events.filter(event => Number.isFinite(event.at.getTime()) && event.at.getTime() <= Date.now() + 60000 && event.at.getTime() > Date.now() - 7 * 86400000);
}
export async function processWebhook(body: Buffer) {
  const events = inboundEvents(JSON.parse(body.toString('utf8')));
  try {
    await prisma.$transaction(async tx => {
      await tx.metaWebhook.create({ data: { hash: hash(body) } });
      for (const event of events) {
        const connection = await tx.metaConnection.findUnique({ where: { platform_externalId: { platform: event.platform, externalId: event.asset } } });
        if (!connection?.enabled) continue;
        const where = { connectionId_externalId: { connectionId: connection.id, externalId: event.sender } };
        await tx.metaContact.upsert({ where, create: { connectionId: connection.id, externalId: event.sender, lastInboundAt: event.at }, update: {} });
        if (event.optOut) await tx.metaContact.updateMany({ where: { connectionId: connection.id, externalId: event.sender }, data: { optedInAt: null, consentEvidence: null } });
        // Out-of-order and duplicate callbacks cannot extend the reply window.
        await tx.metaContact.updateMany({ where: { connectionId: connection.id, externalId: event.sender, lastInboundAt: { lt: event.at } }, data: { lastInboundAt: event.at } });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    throw error;
  }
}
