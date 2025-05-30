/*
  Warnings:

  - You are about to drop the column `svgTemplate` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "isInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "customSvgData" TEXT,
ADD COLUMN     "customText" TEXT,
ADD COLUMN     "selectedMaskId" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "customSvgData" TEXT,
ADD COLUMN     "customText" TEXT,
ADD COLUMN     "selectedMaskId" INTEGER;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "svgTemplate",
ADD COLUMN     "isInclusive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "svg" TEXT,
ADD COLUMN     "tax" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "youtubeLink" TEXT;

-- CreateTable
CREATE TABLE "UserUpload" (
    "id" SERIAL NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "productId" INTEGER,
    "cartItemId" INTEGER,
    "orderItemId" INTEGER,

    CONSTRAINT "UserUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mask" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "maskSvg" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mask_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mask" ADD CONSTRAINT "Mask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
