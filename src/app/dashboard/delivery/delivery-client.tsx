"use client";

import React from "react";
import { useSession } from "next-auth/react";
import DeliveryManagerModal from "@/components/pos/delivery-manager-modal";

export default function DeliveryClient() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "المشرف";
  const userRole = (session?.user as any)?.role || "ADMIN";

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#1F2937] p-2 sm:p-4 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Top Header */}
        <div className="bg-[#243B53] text-white rounded-3xl p-5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1A2C3F] border border-[#334E68] text-[#3B82A0] flex items-center justify-center text-2xl shadow">
              🛵
            </div>
            <div>
              <h1 className="text-xl font-black text-white">
                إدارة الدليفري ودفتر عهدة الطيارين (Rider Cash Ledger)
              </h1>
              <p className="text-xs text-[#D9E2EC] mt-0.5">
                تتبع حالة التوصيل، تسجيل مديونية الطيارين المعلقة، وتوريد النقدية لدرج الكاشير والوردية
              </p>
            </div>
          </div>
        </div>

        {/* Embedded Delivery & Ledger Component */}
        <DeliveryManagerModal
          isOpen={true}
          onClose={() => {}}
          currentUser={userName}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
