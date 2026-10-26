"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import DeliveryManagerModal from "@/components/pos/delivery-manager-modal";

export default function DeliveryClient() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "المشرف";
  const userRole = (session?.user as any)?.role || "ADMIN";

  // In page view, the modal is always open within the page
  return (
    <div className="min-h-screen bg-[#070a13] text-stone-100 p-4 sm:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Top Header */}
        <div className="bg-[#0e1320] border border-[#1e2842] rounded-3xl p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center text-2xl shadow-lg">
              🛵
            </div>
            <div>
              <h1 className="text-xl font-black text-amber-400">
                إدارة الدليفري ودفتر عهدة الطيارين (Rider Cash Ledger)
              </h1>
              <p className="text-xs text-stone-400 mt-0.5">
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
