/*
  Warnings:

  - You are about to drop the column `customizationAreaId` on the `CustomUpload` table. All the data in the column will be lost.
  - You are about to drop the `CustomizationArea` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `height` to the `CustomUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalImageUrl` to the `CustomUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shape` to the `CustomUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `templateId` to the `CustomUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `CustomUpload` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CustomUpload" DROP CONSTRAINT "CustomUpload_customizationAreaId_fkey";

-- DropForeignKey
ALTER TABLE "CustomUpload" DROP CONSTRAINT "CustomUpload_productId_fkey";

-- DropForeignKey
ALTER TABLE "CustomUpload" DROP CONSTRAINT "CustomUpload_userId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationArea" DROP CONSTRAINT "CustomizationArea_productId_fkey";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "customTemplateId" INTEGER;

-- AlterTable
ALTER TABLE "CustomUpload" DROP COLUMN "customizationAreaId",
ADD COLUMN     "areaId" INTEGER,
ADD COLUMN     "height" INTEGER NOT NULL,
ADD COLUMN     "originalImageUrl" TEXT NOT NULL,
ADD COLUMN     "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "scale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "shape" TEXT NOT NULL,
ADD COLUMN     "templateId" INTEGER NOT NULL,
ADD COLUMN     "width" INTEGER NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CustomizationTemplate" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "customTemplateId" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "customizationOptions" JSONB,
ADD COLUMN     "isCustomizable" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "CustomizationArea";

-- CreateTable
CREATE TABLE "CustomizableArea" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "name" TEXT,
    "shape" TEXT NOT NULL,
    "centerX" DOUBLE PRECISION NOT NULL,
    "centerY" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "radius" DOUBLE PRECISION,
    "defaultScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "defaultRotation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defaultPositionX" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defaultPositionY" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomizableArea_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomizableArea" ADD CONSTRAINT "CustomizableArea_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CustomizationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CustomizationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "CustomizableArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
