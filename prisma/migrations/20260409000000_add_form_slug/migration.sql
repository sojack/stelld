-- AlterTable
ALTER TABLE "forms" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "forms_slug_key" ON "forms"("slug");
