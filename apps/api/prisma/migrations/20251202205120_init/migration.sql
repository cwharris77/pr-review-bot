-- CreateTable
CREATE TABLE "Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "installationId" INTEGER NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "commitSha" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_repoOwner_repoName_prNumber_commitSha_key" ON "Review"("repoOwner", "repoName", "prNumber", "commitSha");
