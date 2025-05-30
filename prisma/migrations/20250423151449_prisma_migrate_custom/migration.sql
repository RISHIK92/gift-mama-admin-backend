-- AlterTable
ALTER TABLE "CustomUpload" ALTER COLUMN "height" DROP NOT NULL,
ALTER COLUMN "originalImageUrl" DROP NOT NULL,
ALTER COLUMN "positionX" DROP NOT NULL,
ALTER COLUMN "positionY" DROP NOT NULL,
ALTER COLUMN "rotation" DROP NOT NULL,
ALTER COLUMN "scale" DROP NOT NULL,
ALTER COLUMN "shape" DROP NOT NULL,
ALTER COLUMN "width" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomizableArea" ADD COLUMN     "allowedFormats" TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png']::TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "maxFileSizeMB" DOUBLE PRECISION NOT NULL DEFAULT 5.0;

-- AlterTable
ALTER TABLE "CustomizationTemplate" ADD COLUMN     "thumbnailUrl" TEXT,
ALTER COLUMN "svgData" DROP NOT NULL;
