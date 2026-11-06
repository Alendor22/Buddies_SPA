import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { assertEnabled, MetaError, origin } from './security';

export async function createShare(ownerId: string, kind: 'profile' | 'walk' | 'event', resourceId: string) {
  assertEnabled('SHARING');
  let title: string;
  if (kind === 'profile') {
    const dog = await prisma.dog.findFirst({ where: { id: resourceId, ownerId }, select: { name: true } });
    if (!dog) throw new MetaError(404, 'Profile not found.');
    title = `Meet ${dog.name} on Buddies`;
  } else if (kind === 'walk') {
    const walk = await prisma.walk.findFirst({ where: { id: resourceId, dog: { ownerId } }, select: { dog: { select: { name: true } } } });
    if (!walk) throw new MetaError(404, 'Walk not found.');
    title = `A walk with ${walk.dog.name} on Buddies`;
  } else {
    const event = await prisma.socialEvent.findFirst({ where: { id: resourceId, hostId: ownerId, visibility: 'PUBLIC', OR: [{ groupId: null }, { group: { visibility: 'PUBLIC' } }] }, select: { title: true } });
    if (!event) throw new MetaError(404, 'Public event not found.');
    title = `${event.title} on Buddies`;
  }
  // A deliberately minimal snapshot: no owner contact details, precise locations,
  // dates, medical records, recipient IDs or private resource identifiers.
  const share = await prisma.metaShare.create({ data: { id: randomUUID(), ownerId, title: title.slice(0, 160), expiresAt: new Date(Date.now() + 7 * 86400000) } });
  const url = `${origin()}/share/meta/${share.id}`;
  return { ...share, url, facebook: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`, whatsapp: `https://wa.me/?${new URLSearchParams({ text: `${share.title} ${url}` })}` };
}
