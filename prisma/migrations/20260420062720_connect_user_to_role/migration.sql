/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - Added the required column `roleId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOut" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billNumber" INTEGER NOT NULL DEFAULT 1001,
    "total" REAL NOT NULL,
    "taxableAmount" REAL NOT NULL DEFAULT 0,
    "totalGst" REAL NOT NULL DEFAULT 0,
    "gstPercentage" REAL NOT NULL DEFAULT 0,
    "gstNumber" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeAddress" TEXT NOT NULL,
    "storePhone" TEXT NOT NULL,
    "billType" TEXT NOT NULL DEFAULT 'Normal',
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledBy" TEXT,
    "cancelledAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "payments" TEXT NOT NULL DEFAULT '[]',
    "customerName" TEXT NOT NULL DEFAULT 'Walk-in',
    "customerId" TEXT,
    CONSTRAINT "Bill_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bill_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("billNumber", "billType", "cancelledAt", "cancelledBy", "createdAt", "createdBy", "customerId", "gstNumber", "gstPercentage", "id", "isCancelled", "payments", "storeAddress", "storeName", "storePhone", "taxableAmount", "total", "totalGst", "updatedAt") SELECT "billNumber", "billType", "cancelledAt", "cancelledBy", "createdAt", "createdBy", "customerId", "gstNumber", "gstPercentage", "id", "isCancelled", "payments", "storeAddress", "storeName", "storePhone", "taxableAmount", "total", "totalGst", "updatedAt" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "fullName", "id", "isActive", "isSystem", "passwordHash", "updatedAt", "username") SELECT "createdAt", "fullName", "id", "isActive", "isSystem", "passwordHash", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
