import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { graph, graphList, exchangeCode, version } from './graph';
import { assertEnabled, decrypt, encrypt, hash, MetaError, opaque, origin, required } from './security';

export const purposes = {
  facebook: { flag: 'CONNECTIONS', scopes: ['pages_show_list', 'pages_read_engagement'] },
  instagram: { flag: 'CONNECTIONS', scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic'] },
  facebook_messaging: { flag: 'MESSAGING', scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'pages_messaging'] },
  instagram_messaging: { flag: 'MESSAGING', scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'instagram_basic', 'instagram_manage_messages'] },
  whatsapp: { flag: 'MESSAGING', scopes: ['business_management', 'whatsapp_business_management', 'whatsapp_business_messaging'] }
} as const;
export type Purpose = keyof typeof purposes;
export function purpose(value: string): Purpose {
  if (!Object.hasOwn(purposes, value)) throw new MetaError(400, 'Unknown connection type.');
  return value as Purpose;
}
export function context(ownerId: string, platform: string, externalId: string) { return `${ownerId}:${platform}:${externalId}`; }
export async function throttle(ownerId: string) {
  const minute = Math.floor(Date.now() / 60000);
  const row = await prisma.metaRateBucket.upsert({
    where: { id: hash(`${ownerId}:${minute}`) },
    create: { id: hash(`${ownerId}:${minute}`), expiresAt: new Date((minute + 2) * 60000) },
    update: { count: { increment: 1 } }
  });
  if (row.count > 30) throw new MetaError(429, 'Too many Meta requests. Try again in a minute.');
}
export async function beginConnection(ownerId: string, value: Purpose) {
  assertEnabled('CONNECTIONS');
  assertEnabled(purposes[value].flag);
  const state = opaque();
  const browser = opaque();
  await prisma.metaOAuthState.create({ data: {
    hash: hash(state), ownerId, browserHash: hash(browser), purpose: value, expiresAt: new Date(Date.now() + 600000)
  } });
  const url = new URL(`https://www.facebook.com/${version()}/dialog/oauth`);
  url.searchParams.set('client_id', required('META_APP_ID'));
  url.searchParams.set('redirect_uri', `${origin()}/api/meta/callback`);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', purposes[value].scopes.join(','));
  return { url: url.toString(), browser };
}
export async function finishConnection(ownerId: string, state: string, browser: string, code: string) {
  const entry = await prisma.metaOAuthState.findUnique({ where: { hash: hash(state) } });
  if (!entry || entry.ownerId !== ownerId || entry.browserHash !== hash(browser) || entry.expiresAt.getTime() <= Date.now()) throw new MetaError(400, 'Invalid or expired Meta authorization.');
  const value = purpose(entry.purpose);
  assertEnabled('CONNECTIONS');
  assertEnabled(purposes[value].flag);
  // Atomic single-use claim before exchanging the authorization code.
  const claim = await prisma.metaOAuthState.deleteMany({ where: { hash: entry.hash, ownerId, expiresAt: { gt: new Date() } } });
  if (claim.count !== 1) throw new MetaError(400, 'Meta authorization was already used.');
  const exchanged = await exchangeCode(code, `${origin()}/api/meta/callback`);
  const token = exchanged.access_token;
  const inspected = await graph<{ data: { user_id: string; is_valid: boolean; app_id: string; scopes: string[]; expires_at: number; data_access_expires_at?: number } }>('debug_token', `${required('META_APP_ID')}|${required('META_APP_SECRET')}`, { input_token: token });
  const data = inspected.data;
  if (!data.is_valid || data.app_id !== required('META_APP_ID') || !purposes[value].scopes.every(scope => data.scopes.includes(scope))) throw new MetaError(403, 'Required Meta permissions were not granted.');
  const expiries = [Date.now() + (exchanged.expires_in || 3600) * 1000, data.expires_at * 1000, (data.data_access_expires_at || Infinity) * 1000].filter(n => n > 0);
  const expiresAt = new Date(Math.min(...expiries));
  if (expiresAt.getTime() <= Date.now()) throw new MetaError(403, 'Meta authorization expired.');
  const assets: { platform: string; externalId: string; label: string; accessToken: string }[] = [];
  if (value === 'whatsapp') {
    const businesses = await graphList<{ id: string }>('me/businesses', token, { fields: 'id' });
    for (const business of businesses) {
      const accounts = await graphList<{ id: string }>(`${business.id}/owned_whatsapp_business_accounts`, token, { fields: 'id' });
      for (const account of accounts) {
        const phones = await graphList<{ id: string; verified_name?: string; display_phone_number?: string }>(`${account.id}/phone_numbers`, token, { fields: 'id,verified_name,display_phone_number' });
        for (const phone of phones) assets.push({ platform: 'whatsapp', externalId: phone.id, label: phone.verified_name || 'WhatsApp business', accessToken: token });
        await graph(`${account.id}/subscribed_apps`, token, {}, {});
      }
    }
  } else {
    const pages = await graphList<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }>('me/accounts', token, { fields: `id,name,access_token${value.startsWith('instagram') ? ',instagram_business_account{id,username}' : ''}` });
    for (const page of pages) {
      const instagram = value.startsWith('instagram');
      const externalId = instagram ? page.instagram_business_account?.id : page.id;
      if (!externalId) continue;
      assets.push({ platform: instagram ? 'instagram' : 'facebook', externalId, label: instagram ? page.instagram_business_account?.username || page.name : page.name, accessToken: page.access_token });
      if (value.endsWith('_messaging')) await graph(`${page.id}/subscribed_apps`, page.access_token, {}, { subscribed_fields: 'messages' });
    }
  }
  if (!assets.length) throw new MetaError(422, 'No eligible business assets were authorized.');
  await prisma.$transaction(async tx => {
    for (const asset of assets) {
      const where = { platform_externalId: { platform: asset.platform, externalId: asset.externalId } };
      const existing = await tx.metaConnection.findUnique({ where });
      if (existing && existing.ownerId !== ownerId) throw new MetaError(409, 'A business asset is already connected to another Buddies owner.');
      const saved = { providerUserId: data.user_id, label: asset.label, token: encrypt(asset.accessToken, context(ownerId, asset.platform, asset.externalId)), expiresAt, scopes: [...purposes[value].scopes], enabled: false };
      await tx.metaConnection.upsert({ where, create: { ...saved, ownerId, platform: asset.platform, externalId: asset.externalId }, update: saved });
    }
  });
}
export async function ownedConnection(ownerId: string, id: string) {
  const connection = await prisma.metaConnection.findFirst({ where: { id, ownerId } });
  if (!connection) throw new MetaError(404, 'Connection not found.');
  return connection;
}
export async function sendMessage(ownerId: string, input: { connectionId: string; contactId: string; senderDogId: string; key: string; text?: string; template?: string; language?: string }) {
  assertEnabled('MESSAGING');
  const dog = await prisma.dog.findFirst({ where: { id: input.senderDogId, ownerId }, select: { id: true } });
  if (!dog) throw new MetaError(403, 'Select a dog owned by your account.');
  const connection = await ownedConnection(ownerId, input.connectionId);
  if (!connection.enabled || connection.expiresAt.getTime() <= Date.now()) throw new MetaError(403, 'Connection is disabled or expired.');
  const scope = connection.platform === 'facebook' ? 'pages_messaging' : connection.platform === 'instagram' ? 'instagram_manage_messages' : 'whatsapp_business_messaging';
  if (!connection.scopes.includes(scope)) throw new MetaError(403, 'Reconnect with messaging permission.');
  const contact = await prisma.metaContact.findFirst({ where: { id: input.contactId, connectionId: connection.id } });
  if (!contact?.optedInAt) throw new MetaError(403, 'Recipient consent is required.');
  let payload: unknown;
  if (connection.platform === 'whatsapp' && input.template) {
    const allowed = (process.env.META_WHATSAPP_TEMPLATES || '').split(',');
    if (!input.language || !allowed.includes(`${input.template}:${input.language}`)) throw new MetaError(403, 'Template is not approved for this application.');
    payload = { messaging_product: 'whatsapp', to: contact.externalId, type: 'template', template: { name: input.template, language: { code: input.language } } };
  } else {
    if (!input.text || Date.now() - contact.lastInboundAt.getTime() >= 24 * 3600000) throw new MetaError(403, 'Replies require an inbound message within 24 hours.');
    payload = connection.platform === 'whatsapp'
      ? { messaging_product: 'whatsapp', to: contact.externalId, type: 'text', text: { body: input.text } }
      : { recipient: { id: contact.externalId }, message: { text: input.text }, ...(connection.platform === 'facebook' ? { messaging_type: 'RESPONSE' } : {}) };
  }
  const id = hash(`${ownerId}:${connection.id}:${input.key}`);
  try { await prisma.metaDelivery.create({ data: { id, connectionId: connection.id, senderDogId: dog.id } }); }
  catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    return prisma.metaDelivery.findUnique({ where: { id }, select: { id: true, status: true, providerId: true } });
  }
  // Never automatically retry a timeout: Meta may already have accepted the send.
  try {
    const response = await graph<{ message_id?: string; messages?: { id: string }[] }>(`${connection.externalId}/messages`, decrypt(connection.token, context(ownerId, connection.platform, connection.externalId)), {}, payload);
    return await prisma.metaDelivery.update({ where: { id }, data: { status: 'SENT', providerId: response.message_id || response.messages?.[0]?.id }, select: { id: true, status: true, providerId: true } });
  } catch (error) {
    await prisma.metaDelivery.update({ where: { id }, data: { status: 'UNKNOWN' } });
    throw error;
  }
}
