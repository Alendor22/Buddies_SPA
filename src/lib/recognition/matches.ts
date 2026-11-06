import { prisma } from '@/lib/db';
import { RecognitionAuthorizationError, RecognitionStateError } from './service';

export type MatchViewerRole = 'owner' | 'reporter';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

function mimeTypeForStorageKey(storageKey: string) {
  const extension = storageKey.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

async function loadMatchContext(requestId: string, dogId: string) {
  const event = await prisma.recognitionEvent.findUnique({ where: { requestId } });
  if (!event) throw new RecognitionStateError('This lost-dog match no longer exists.');

  const candidate = await prisma.recognitionEventCandidate.findUnique({
    where: { recognitionEventId_dogId: { recognitionEventId: event.id, dogId } }
  });
  if (!candidate) throw new RecognitionAuthorizationError('This dog was not a candidate for that search.');

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    select: { id: true, name: true, slug: true, photoUrl: true, ownerId: true, status: true }
  });
  if (!dog) throw new RecognitionStateError('This dog profile no longer exists.');

  return { event, candidate, dog };
}

function roleFor(userId: string, event: { reporterUserId: string | null }, dog: { ownerId: string }): MatchViewerRole {
  if (dog.ownerId === userId) return 'owner';
  if (event.reporterUserId === userId) return 'reporter';
  throw new RecognitionAuthorizationError('You are not part of this lost-dog match.');
}

export async function getMatchForViewer(input: { requestId: string; dogId: string; userId: string }) {
  const { event, candidate, dog } = await loadMatchContext(input.requestId, input.dogId);
  const role = roleFor(input.userId, event, dog);

  const photoAvailable = Boolean(
    event.photoStorageKey && event.photoExpiresAt && event.photoExpiresAt.getTime() > Date.now()
  );

  return {
    role,
    dog: { id: dog.id, name: dog.name, slug: dog.slug, photoUrl: dog.photoUrl, status: dog.status },
    score: candidate.score,
    matchedAt: candidate.createdAt,
    photoAvailable,
    photoExpiresAt: event.photoExpiresAt
  };
}

export async function getMatchPhoto(input: { requestId: string; dogId: string; userId: string }) {
  const { event, dog } = await loadMatchContext(input.requestId, input.dogId);
  roleFor(input.userId, event, dog);

  if (!event.photoStorageKey || !event.photoExpiresAt || event.photoExpiresAt.getTime() <= Date.now()) {
    throw new RecognitionStateError('This photo has expired and was automatically deleted.');
  }

  return { storageKey: event.photoStorageKey, mimeType: mimeTypeForStorageKey(event.photoStorageKey) };
}

export async function listMatchMessages(input: { requestId: string; dogId: string; userId: string }) {
  const { event, dog } = await loadMatchContext(input.requestId, input.dogId);
  roleFor(input.userId, event, dog);

  const messages = await prisma.recognitionMatchMessage.findMany({
    where: { recognitionEventId: event.id, dogId: input.dogId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, senderId: true, body: true, createdAt: true }
  });

  return { messages, reporterUserId: event.reporterUserId, ownerId: dog.ownerId };
}

export async function sendMatchMessage(input: { requestId: string; dogId: string; userId: string; body: string }) {
  const body = input.body.trim().slice(0, 2000);
  if (!body) throw new RecognitionStateError('Message is required.');

  const { event, dog } = await loadMatchContext(input.requestId, input.dogId);
  const role = roleFor(input.userId, event, dog);
  if (!event.reporterUserId) throw new RecognitionStateError('This match has no reporter to contact.');

  const message = await prisma.recognitionMatchMessage.create({
    data: { recognitionEventId: event.id, dogId: input.dogId, senderId: input.userId, body }
  });

  const recipientId = role === 'owner' ? event.reporterUserId : dog.ownerId;
  return { message, recipientId, dogName: dog.name };
}
