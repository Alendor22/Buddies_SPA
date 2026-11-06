import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, DogStatus, WalkStatus } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be set before seeding.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const users = [
  {
    id: 'seed_user_adeja',
    email: 'adeja@example.test',
    displayName: 'Adeja',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    bio: 'Dog parent and Buddies early adopter.',
    latitude: 40.7357,
    longitude: -74.1724
  },
  {
    id: 'seed_user_maya',
    email: 'maya@example.test',
    displayName: 'Maya',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    bio: 'Weekend trail walker and rescue volunteer.',
    latitude: 40.7421,
    longitude: -74.1686
  },
  {
    id: 'seed_user_jordan',
    email: 'jordan@example.test',
    displayName: 'Jordan',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bio: 'Always looking for a new dog-friendly park.',
    latitude: 40.7284,
    longitude: -74.1832
  },
  {
    id: 'seed_user_priya',
    email: 'priya@example.test',
    displayName: 'Priya',
    avatarUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80',
    bio: 'Small-dog social coordinator.',
    latitude: 40.7219,
    longitude: -74.1598
  },
  {
    id: 'seed_user_marcus',
    email: 'marcus@example.test',
    displayName: 'Marcus',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bio: 'Morning runner with two energetic dogs.',
    latitude: 40.7486,
    longitude: -74.1881
  },
  {
    id: 'seed_user_elena',
    email: 'elena@example.test',
    displayName: 'Elena',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
    bio: 'Senior-dog advocate and foster parent.',
    latitude: 40.7312,
    longitude: -74.1517
  }
];

const dogs = [
  ['seed_dog_buddy', 'seed_user_adeja', 'Buddy', 'buddy', 'Golden Retriever', '2021-04-14', 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7357, -74.1724],
  ['seed_dog_luna', 'seed_user_maya', 'Luna', 'luna', 'Siberian Husky', '2020-09-03', 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7421, -74.1686],
  ['seed_dog_max', 'seed_user_jordan', 'Max', 'max', 'German Shepherd', '2019-06-21', 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7284, -74.1832],
  ['seed_dog_daisy', 'seed_user_priya', 'Daisy', 'daisy', 'Cavalier King Charles Spaniel', '2022-01-11', 'https://images.unsplash.com/photo-1544717297-fa95b6ee9643?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7219, -74.1598],
  ['seed_dog_rocky', 'seed_user_marcus', 'Rocky', 'rocky', 'Boxer', '2020-02-08', 'https://images.unsplash.com/photo-1543071220-6ee5bf71a54e?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7486, -74.1881],
  ['seed_dog_coco', 'seed_user_elena', 'Coco', 'coco', 'French Bulldog', '2021-11-19', 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7312, -74.1517],
  ['seed_dog_milo', 'seed_user_marcus', 'Milo', 'milo', 'Labrador Retriever', '2023-03-30', 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7469, -74.1864],
  ['seed_dog_bella', 'seed_user_maya', 'Bella', 'bella', 'Beagle', '2018-08-17', 'https://images.unsplash.com/photo-1505628346881-b72b27e84530?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7407, -74.1668],
  ['seed_dog_teddy', 'seed_user_priya', 'Teddy', 'teddy', 'Miniature Poodle', '2022-07-05', 'https://images.unsplash.com/photo-1616190264687-b7ebf7aa2eb4?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7231, -74.1574],
  ['seed_dog_sadie', 'seed_user_elena', 'Sadie', 'sadie', 'Mixed Breed', '2017-12-12', 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7325, -74.1531],
  ['seed_dog_nova', 'seed_user_jordan', 'Nova', 'nova', 'Australian Shepherd', '2021-05-23', 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7298, -74.1814],
  ['seed_dog_ollie', 'seed_user_adeja', 'Ollie', 'ollie', 'Boston Terrier', '2023-10-01', 'https://images.unsplash.com/photo-1612536057832-2ff7ead58194?auto=format&fit=crop&w=900&q=80', DogStatus.SAFE, 40.7342, -74.1708]
].map(([id, ownerId, name, slug, breed, birthDate, photoUrl, status, latitude, longitude]) => ({
  id,
  ownerId,
  name,
  slug,
  breed,
  birthDate: new Date(`${birthDate}T12:00:00.000Z`),
  photoUrl,
  status,
  medicalNotes: 'No active medical alerts.',
  emergencyContact: 'Seed emergency contact: 555-0100',
  latitude,
  longitude
}));

const walks = [
  {
    id: 'seed_walk_1',
    dogId: 'seed_dog_buddy',
    requesterId: 'seed_user_adeja',
    walkerId: 'seed_user_maya',
    startsAt: new Date('2026-07-02T22:00:00.000Z'),
    durationMin: 45,
    status: WalkStatus.ACCEPTED,
    notes: 'Meet near the south entrance of Branch Brook Park.'
  },
  {
    id: 'seed_walk_2',
    dogId: 'seed_dog_luna',
    requesterId: 'seed_user_maya',
    walkerId: 'seed_user_jordan',
    startsAt: new Date('2026-07-04T14:30:00.000Z'),
    durationMin: 60,
    status: WalkStatus.REQUESTED,
    notes: 'Bring water; Luna prefers shaded routes.'
  },
  {
    id: 'seed_walk_3',
    dogId: 'seed_dog_sadie',
    requesterId: 'seed_user_elena',
    walkerId: 'seed_user_adeja',
    startsAt: new Date('2026-06-27T16:00:00.000Z'),
    durationMin: 30,
    status: WalkStatus.COMPLETED,
    notes: 'Easy senior-dog pace.'
  },
  {
    id: 'seed_walk_4',
    dogId: 'seed_dog_rocky',
    requesterId: 'seed_user_marcus',
    walkerId: null,
    startsAt: new Date('2026-07-06T11:00:00.000Z'),
    durationMin: 40,
    status: WalkStatus.REQUESTED,
    notes: 'Rocky is leash trained and high energy.'
  }
];

const messages = [
  {
    id: 'seed_message_1',
    walkId: 'seed_walk_1',
    senderId: 'seed_user_adeja',
    body: 'Buddy will be ready at the south entrance.',
    createdAt: new Date('2026-06-28T15:00:00.000Z')
  },
  {
    id: 'seed_message_2',
    walkId: 'seed_walk_1',
    senderId: 'seed_user_maya',
    body: 'Confirmed. I will bring an extra water bowl.',
    createdAt: new Date('2026-06-28T15:05:00.000Z')
  },
  {
    id: 'seed_message_3',
    walkId: 'seed_walk_3',
    senderId: 'seed_user_elena',
    body: 'Thanks for keeping the pace comfortable for Sadie.',
    createdAt: new Date('2026-06-27T17:00:00.000Z')
  }
];

const qrScans = [
  {
    id: 'seed_scan_1',
    dogId: 'seed_dog_buddy',
    latitude: 40.7361,
    longitude: -74.1719,
    userAgent: 'Buddies deterministic seed',
    createdAt: new Date('2026-06-25T18:00:00.000Z')
  },
  {
    id: 'seed_scan_2',
    dogId: 'seed_dog_luna',
    latitude: 40.7418,
    longitude: -74.1682,
    userAgent: 'Buddies deterministic seed',
    createdAt: new Date('2026-06-26T19:30:00.000Z')
  }
];

const sightings = [
  {
    id: 'seed_sighting_1',
    dogId: 'seed_dog_max',
    note: 'Test sighting near the park entrance.',
    latitude: 40.7291,
    longitude: -74.1825,
    createdAt: new Date('2026-06-24T13:15:00.000Z')
  }
];

async function seed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_SEED !== 'true') {
    throw new Error('Refusing to seed production. Set ALLOW_DB_SEED=true to override intentionally.');
  }

  await prisma.$transaction([
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

  console.log(`Seed complete: ${users.length} users, ${dogs.length} dogs, ${walks.length} walks, ${messages.length} messages, ${qrScans.length} QR scans, ${sightings.length} sighting.`);
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
