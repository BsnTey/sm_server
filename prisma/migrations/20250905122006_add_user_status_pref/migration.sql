-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('accepted', 'check_availability', 'availability_confirmed', 'completing', 'ready_to_issue', 'issued', 'accepted_in_work', 'ord_sent_to_cc', 'ord_accepted_to_cc', 'ord_sent_to_delivery_region', 'arrived_to_region_and_awaiting_delivery', 'transfered_for_delivery', 'ord_full_delivered', 'delivered');

-- AlterTable
ALTER TABLE "user_telegram" ADD COLUMN     "user_status_pref" "OrderStatus"[];
