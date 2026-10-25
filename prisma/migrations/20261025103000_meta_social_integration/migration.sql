BEGIN;

-- CreateTable
CREATE TABLE "MetaConnection" (
    "providerUserId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaOAuthState" (
    "hash" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaOAuthState_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "MetaContact" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "lastInboundAt" TIMESTAMP(3) NOT NULL,
    "optedInAt" TIMESTAMP(3),
    "consentEvidence" TEXT,

    CONSTRAINT "MetaContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaDelivery" (
    "senderDogId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaWebhook" (
    "hash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaWebhook_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "MetaRateBucket" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaRateBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaShare" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaConnection_providerUserId_idx" ON "MetaConnection"("providerUserId");

-- CreateIndex
CREATE INDEX "MetaConnection_ownerId_idx" ON "MetaConnection"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConnection_platform_externalId_key" ON "MetaConnection"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaContact_connectionId_externalId_key" ON "MetaContact"("connectionId", "externalId");

-- AddForeignKey
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaOAuthState" ADD CONSTRAINT "MetaOAuthState_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaContact" ADD CONSTRAINT "MetaContact_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDelivery" ADD CONSTRAINT "MetaDelivery_senderDogId_fkey" FOREIGN KEY ("senderDogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDelivery" ADD CONSTRAINT "MetaDelivery_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaShare" ADD CONSTRAINT "MetaShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
