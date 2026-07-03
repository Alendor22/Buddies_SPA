import { PrismaClient, DogStatus, WalkStatus, FriendshipStatus, PackRole, PackPostKind } from '@prisma/client';

const prisma = new PrismaClient();

const users = [
  { id: 'seed_user_adeja', email: 'adeja@example.test', displayName: 'Adeja', bio: 'Dog parent and Buddies early adopter.', latitude: 40.7357, longitude: -74.1724 },
  { id: 'seed_user_maya', email: 'maya@example.test', displayName: 'Maya', bio: 'Weekend trail walker and rescue volunteer.', latitude: 40.7421, longitude: -74.1686 },
  { id: 'seed_user_jordan', email: 'jordan@example.test', displayName: 'Jordan', bio: 'Always looking for a new dog-friendly park.', latitude: 40.7284, longitude: -74.1832 },
  { id: 'seed_user_priya', email: 'priya@example.test', displayName: 'Priya', bio: 'Small-dog social coordinator.', latitude: 40.7219, longitude: -74.1598 },
  { id: 'seed_user_marcus', email: 'marcus@example.test', displayName: 'Marcus', bio: 'Morning runner with two energetic dogs.', latitude: 40.7486, longitude: -74.1881 },
  { id: 'seed_user_elena', email: 'elena@example.test', displayName: 'Elena', bio: 'Senior-dog advocate and foster parent.', latitude: 40.7312, longitude: -74.1517 }
];

const dogs = [
  ['seed_dog_buddy', 'seed_user_adeja', 'Buddy', 'buddy', 'Golden Retriever', '2021-04-14', DogStatus.SAFE, 40.7357, -74.1724],
  ['seed_dog_luna', 'seed_user_maya', 'Luna', 'luna', 'Siberian Husky', '2020-09-03', DogStatus.SAFE, 40.7421, -74.1686],
  ['seed_dog_max', 'seed_user_jordan', 'Max', 'max', 'German Shepherd', '2019-06-21', DogStatus.SAFE, 40.7284, -74.1832],
  ['seed_dog_teddy', 'seed_user_priya', 'Teddy', 'teddy', 'Miniature Poodle', '2022-07-05', DogStatus.SAFE, 40.7231, -74.1574],
  ['seed_dog_sadie', 'seed_user_elena', 'Sadie', 'sadie', 'Mixed Breed', '2017-12-12', DogStatus.SAFE, 40.7325, -74.1531],
  ['seed_dog_ollie', 'seed_user_adeja', 'Ollie', 'ollie', 'Boston Terrier', '2023-10-01', DogStatus.SAFE, 40.7342, -74.1708]
].map(([id, ownerId, name, slug, breed, birthDate, status, latitude, longitude]) => ({
  id,
  ownerId,
  name,
  slug,
  breed,
  birthDate: new Date(`${birthDate}T12:00:00.000Z`),
  status,
  medicalNotes: 'No active medical alerts.',
  emergencyContact: 'Seed contact',
  latitude,
  longitude
}));

const walks = [
  { id: 'seed_walk_1', dogId: 'seed_dog_buddy', requesterId: 'seed_user_adeja', walkerId: 'seed_user_maya', startsAt: new Date('2026-07-02T22:00:00.000Z'), durationMin: 45, status: WalkStatus.ACCEPTED, notes: 'Meet near the south entrance.' },
  { id: 'seed_walk_2', dogId: 'seed_dog_luna', requesterId: 'seed_user_maya', walkerId: 'seed_user_jordan', startsAt: new Date('2026-07-04T14:30:00.000Z'), durationMin: 60, status: WalkStatus.REQUESTED, notes: 'Bring water.' }
];

const messages = [
  { id: 'seed_message_1', walkId: 'seed_walk_1', senderId: 'seed_user_adeja', body: 'Buddy will be ready.', createdAt: new Date('2026-06-28T15:00:00.000Z') },
  { id: 'seed_message_2', walkId: 'seed_walk_1', senderId: 'seed_user_maya', body: 'Confirmed.', createdAt: new Date('2026-06-28T15:05:00.000Z') }
];

const qrScans = [
  { id: 'seed_scan_1', dogId: 'seed_dog_buddy', latitude: 40.7361, longitude: -74.1719, userAgent: 'Buddies deterministic seed', createdAt: new Date('2026-06-25T18:00:00.000Z') }
];

const sightings = [
  { id: 'seed_sighting_1', dogId: 'seed_dog_max', note: 'Test sighting near the park entrance.', latitude: 40.7291, longitude: -74.1825, createdAt: new Date('2026-06-24T13:15:00.000Z') }
];

const friendships = [
  { id: 'seed_friendship_1', requesterId: 'seed_user_adeja', addresseeId: 'seed_user_maya', status: FriendshipStatus.ACCEPTED, note: 'Frequent walk coordination.' },
  { id: 'seed_friendship_2', requesterId: 'seed_user_jordan', addresseeId: 'seed_user_adeja', status: FriendshipStatus.PENDING, note: 'Nova and Buddy should meet.' },
  { id: 'seed_friendship_3', requesterId: 'seed_user_adeja', addresseeId: 'seed_user_priya', status: FriendshipStatus.PENDING, note: 'Small dog meetup request.' },
  { id: 'seed_friendship_4', requesterId: 'seed_user_elena', addresseeId: 'seed_user_adeja', status: FriendshipStatus.ACCEPTED, note: 'Senior-dog care network.' }
];

const packs = [
  { id: 'seed_pack_branch_brook', name: 'Branch Brook Morning Pack', slug: 'branch-brook-morning-pack', description: 'Early walks, check-ins, and safe meetup coordination.', city: 'Newark, NJ', latitude: 40.7412, longitude: -74.1724, ownerId: 'seed_user_adeja' },
  { id: 'seed_pack_small_buddies', name: 'Small Buddies Social', slug: 'small-buddies-social', description: 'Low-pressure social group for small and senior dogs.', city: 'Newark, NJ', latitude: 40.7244, longitude: -74.1591, ownerId: 'seed_user_priya' }
];

const packMemberships = [
  { id: 'seed_membership_1', packId: 'seed_pack_branch_brook', userId: 'seed_user_adeja', dogId: 'seed_dog_buddy', role: PackRole.OWNER },
  { id: 'seed_membership_2', packId: 'seed_pack_branch_brook', userId: 'seed_user_maya', dogId: 'seed_dog_luna', role: PackRole.MEMBER },
  { id: 'seed_membership_3', packId: 'seed_pack_branch_brook', userId: 'seed_user_jordan', dogId: 'seed_dog_max', role: PackRole.MEMBER },
  { id: 'seed_membership_4', packId: 'seed_pack_small_buddies', userId: 'seed_user_priya', dogId: 'seed_dog_teddy', role: PackRole.OWNER },
  { id: 'seed_membership_5', packId: 'seed_pack_small_buddies', userId: 'seed_user_elena', dogId: 'seed_dog_sadie', role: PackRole.MODERATOR }
];

const packPosts = [
  { id: 'seed_pack_post_1', packId: 'seed_pack_branch_brook', authorId: 'seed_user_adeja', kind: PackPostKind.MEETUP, title: 'Saturday group loop', body: 'Meet at the south entrance.', latitude: 40.7398, longitude: -74.1705, startsAt: new Date('2026-07-04T13:00:00.000Z') },
  { id: 'seed_pack_post_2', packId: 'seed_pack_small_buddies', authorId: 'seed_user_priya', kind: PackPostKind.MEETUP, title: 'Small dog decompression walk', body: 'Short route with plenty of distance.', latitude: 40.723, longitude: -74.158, startsAt: new Date('2026-07-05T15:00:00.000Z') }
];

async function seed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_SEED !== 'true') {
    throw new Error('Refusing to seed production. Set ALLOW_DB_SEED=true to override intentionally.');
  }

  await prisma.$transaction([
    prisma.packPost.deleteMany(),
    prisma.packMembership.deleteMany(),
    prisma.pack.deleteMany(),
    prisma.friendship.deleteMany(),
    prisma.message.deleteMany(),
    prisma.qrScan.deleteMany(),
    prisma.sighting.deleteMany(),
    prisma.walk.deleteMany(),
    prisma.dog.deleteMany(),
    prisma.user.deleteMany()
  ]);

  await prisma.user.createMany({ data: users });
  await prisma.dog.createMany({ data: dogs });
  await prisma.walk.createMany({ data: walks });
  await prisma.message.createMany({ data: messages });
  await prisma.qrScan.createMany({ data: qrScans });
  await prisma.sighting.createMany({ data: sightings });
  await prisma.friendship.createMany({ data: friendships });
  await prisma.pack.createMany({ data: packs });
  await prisma.packMembership.createMany({ data: packMemberships });
  await prisma.packPost.createMany({ data: packPosts });

  console.log('Seed complete.');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
