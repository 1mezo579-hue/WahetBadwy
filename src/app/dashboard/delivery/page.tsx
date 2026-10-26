import { Metadata } from "next";
import DeliveryClient from "./delivery-client";

export const metadata: Metadata = {
  title: "إدارة الدليفري وعهدة الطيارين | مشويات بسيوني",
  description: "دفتر عهدة الطيارين وإدارة دورة طلبات التوصيل والتسويات المالية لدرج الكاشير",
};

export default function DeliveryDashboardPage() {
  return <DeliveryClient />;
}
