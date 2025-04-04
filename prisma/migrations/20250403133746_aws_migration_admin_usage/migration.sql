/*
  Warnings:

  - You are about to drop the `_CouponToOrder` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `discountType` on the `Coupon` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- DropForeignKey
ALTER TABLE "_CouponToOrder" DROP CONSTRAINT "_CouponToOrder_A_fkey";

-- DropForeignKey
ALTER TABLE "_CouponToOrder" DROP CONSTRAINT "_CouponToOrder_B_fkey";

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "appliedCouponId" INTEGER,
ADD COLUMN     "couponDiscountAmount" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "couponDiscountType" TEXT,
ADD COLUMN     "couponDiscountValue" DECIMAL(65,30),
ADD COLUMN     "deliveryFee" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "Coupon" DROP COLUMN "discountType",
ADD COLUMN     "discountType" "DiscountType" NOT NULL;

-- AlterTable
ALTER TABLE "CouponUsage" ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "appliedCouponId" INTEGER,
ADD COLUMN     "couponDiscountAmount" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveryFee" DECIMAL(65,30) DEFAULT 0;

-- DropTable
DROP TABLE "_CouponToOrder";

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_appliedCouponId_fkey" FOREIGN KEY ("appliedCouponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_appliedCouponId_fkey" FOREIGN KEY ("appliedCouponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
