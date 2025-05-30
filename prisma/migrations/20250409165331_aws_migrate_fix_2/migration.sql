/*
  Warnings:

  - You are about to drop the column `isInclusive` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `customSvgData` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `customText` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `selectedMaskId` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `isInclusive` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `customSvgData` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `customText` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `selectedMaskId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `isInclusive` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `svg` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeLink` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the `Mask` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserUpload` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Mask" DROP CONSTRAINT "Mask_productId_fkey";

-- DropForeignKey
ALTER TABLE "UserUpload" DROP CONSTRAINT "UserUpload_cartItemId_fkey";

-- DropForeignKey
ALTER TABLE "UserUpload" DROP CONSTRAINT "UserUpload_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE "UserUpload" DROP CONSTRAINT "UserUpload_productId_fkey";

-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "isInclusive",
DROP COLUMN "tax";

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "customSvgData",
DROP COLUMN "customText",
DROP COLUMN "selectedMaskId";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "isInclusive",
DROP COLUMN "tax";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "customSvgData",
DROP COLUMN "customText",
DROP COLUMN "selectedMaskId";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "isInclusive",
DROP COLUMN "svg",
DROP COLUMN "tax",
DROP COLUMN "youtubeLink",
ADD COLUMN     "svgTemplate" TEXT;

-- DropTable
DROP TABLE "Mask";

-- DropTable
DROP TABLE "UserUpload";
