const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('C:/Users/BS/.gemini/antigravity/scratch/wahet-badawy/src/app/pos/pos-interface.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// Detect line separator
const eol = content.includes('\r\n') ? '\r\n' : '\n';
console.log('Detected EOL:', JSON.stringify(eol));

// 1. Add Draft Notice Banner
const headerComment = '{/* Header: Title + New Order Button */}';
const draftBanner = `{/* Draft Notice Banner */}
          {draftNotice && cart.length > 0 && (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl px-2.5 py-1.5 mb-2 flex items-center justify-between text-[11px] text-amber-300 animate-fadeIn">
              <div className="flex items-center gap-1.5">
                <span>⚡</span>
                <span className="font-bold">تم استرجاع مسودة الطلب تلقائياً</span>
              </div>
              <button
                onClick={() => setDraftNotice(false)}
                className="text-stone-400 hover:text-white text-xs px-1"
                title="إخفاء التنبيه"
              >
                ✕
              </button>
            </div>
          )}

          `.replace(/\n/g, eol);

if (!content.includes('تم استرجاع مسودة الطلب تلقائياً')) {
  const idx = content.indexOf(headerComment);
  if (idx !== -1) {
    content = content.slice(0, idx) + draftBanner + content.slice(idx);
    console.log('Draft Banner inserted successfully!');
  } else {
    console.error('headerComment not found!');
  }
}

// 2. Add Payment Method Selector & Change Calculator
const actionButtonsComment = '{/* Action Buttons Row */}';
const paymentBlock = `{/* Payment Method & Change Calculator */}
          <div className="bg-[#121217] border border-orange-500/25 rounded-xl p-2 mb-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-400 text-[10px] font-bold">طريقة التحصيل:</span>
              <span className="text-[10px] font-mono text-orange-400">
                {paymentMethod === "CASH" ? "نقداً" : paymentMethod === "CARD" ? "فيزا / شبكة" : "محفظة كاش"}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={\`py-1.5 px-1 rounded-lg text-center font-bold text-[11px] transition flex items-center justify-center gap-1 \${
                  paymentMethod === "CASH"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 font-black border border-emerald-400"
                    : "bg-[#181820] text-stone-300 border border-stone-800 hover:border-stone-700"
                }\`}
              >
                <span>💵</span>
                <span>كاش</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("CARD")}
                className={\`py-1.5 px-1 rounded-lg text-center font-bold text-[11px] transition flex items-center justify-center gap-1 \${
                  paymentMethod === "CARD"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30 font-black border border-blue-400"
                    : "bg-[#181820] text-stone-300 border border-stone-800 hover:border-stone-700"
                }\`}
              >
                <span>💳</span>
                <span>فيزا</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("WALLET")}
                className={\`py-1.5 px-1 rounded-lg text-center font-bold text-[11px] transition flex items-center justify-center gap-1 \${
                  paymentMethod === "WALLET"
                    ? "bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md shadow-purple-600/30 font-black border border-purple-400"
                    : "bg-[#181820] text-stone-300 border border-stone-800 hover:border-stone-700"
                }\`}
              >
                <span>📱</span>
                <span>محفظة</span>
              </button>
            </div>

            {paymentMethod === "CASH" && (
              <div className="pt-1 border-t border-stone-800 space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-stone-400 font-bold shrink-0">المدفوع:</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      placeholder={totalAmount > 0 ? String(totalAmount) : "0"}
                      className="w-full bg-[#181822] border border-emerald-500/40 focus:border-emerald-500 text-emerald-300 text-left font-mono font-black text-xs rounded-lg px-2 py-1 outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[9px] text-stone-500">ج.م</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setAmountPaidInput(totalAmount.toString())}
                    className="bg-stone-800 hover:bg-emerald-600/40 text-stone-200 text-[9px] font-bold py-1 rounded border border-stone-700 transition"
                  >
                    بالضبط
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = Math.ceil(totalAmount / 50) * 50;
                      setAmountPaidInput((base === totalAmount ? base + 50 : base).toString());
                    }}
                    className="bg-stone-800 hover:bg-emerald-600/40 text-stone-200 text-[9px] font-bold py-1 rounded border border-stone-700 transition"
                  >
                    +50
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = Math.ceil(totalAmount / 100) * 100;
                      setAmountPaidInput((base === totalAmount ? base + 100 : base).toString());
                    }}
                    className="bg-stone-800 hover:bg-emerald-600/40 text-stone-200 text-[9px] font-bold py-1 rounded border border-stone-700 transition"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = Math.ceil(totalAmount / 200) * 200;
                      setAmountPaidInput((base === totalAmount ? base + 200 : base).toString());
                    }}
                    className="bg-stone-800 hover:bg-emerald-600/40 text-stone-200 text-[9px] font-bold py-1 rounded border border-stone-700 transition"
                  >
                    +200
                  </button>
                </div>

                <div className="flex items-center justify-between bg-[#0b1410] border border-emerald-500/40 rounded-lg px-2 py-1 text-[11px]">
                  <span className="text-emerald-400 font-bold">الباقي للعميل:</span>
                  <span className="font-mono font-black text-emerald-300 text-xs">
                    {changeDue.toFixed(2)} ج.م
                  </span>
                </div>
              </div>
            )}
          </div>

          `.replace(/\n/g, eol);

if (!content.includes('طريقة التحصيل:')) {
  const idx = content.indexOf(actionButtonsComment);
  if (idx !== -1) {
    content = content.slice(0, idx) + paymentBlock + content.slice(idx);
    console.log('Payment Block inserted successfully!');
  } else {
    console.error('actionButtonsComment not found!');
  }
}

// 3. Add Reprint Button right before </section> that closes section C
const section3Comment = '{/* 3. BOTTOM SECTION: RECENT ORDERS';
const reprintButtonBlock = `
          {/* Reprint Last Completed Receipt (Read-Only Copy) */}
          <button
            type="button"
            onClick={handleReprintLastReceipt}
            disabled={!lastCompletedReceipt}
            className={\`w-full mt-2 py-2 px-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition border \${
              lastCompletedReceipt
                ? "bg-[#181822] hover:bg-stone-800 text-amber-300 border-amber-500/40 hover:border-amber-500 shadow-md"
                : "bg-[#121217] text-stone-600 border-stone-800/60 cursor-not-allowed opacity-50"
            }\`}
            title="إعادة طباعة آخر فاتورة تم إتمامها كنسخة طبق الأصل دون إنشاء أي حركة بيع جديدة"
          >
            <span className="text-xs">🔄</span>
            <span>إعادة طباعة آخر فاتورة</span>
            {lastCompletedReceipt?.orderNumber && (
              <span className="text-[10px] font-mono text-orange-400 bg-orange-950/80 px-1.5 py-0.2 rounded border border-orange-800 font-bold">
                #{lastCompletedReceipt.orderNumber}
              </span>
            )}
          </button>
`.replace(/\n/g, eol);

if (!content.includes('إعادة طباعة آخر فاتورة</span>')) {
  const s3Idx = content.indexOf(section3Comment);
  if (s3Idx !== -1) {
    // Find the </section> preceding section 3 comment
    const closingSectionIdx = content.lastIndexOf('</section>', s3Idx);
    if (closingSectionIdx !== -1) {
      content = content.slice(0, closingSectionIdx) + reprintButtonBlock + eol + '        ' + content.slice(closingSectionIdx);
      console.log('Reprint Button inserted successfully!');
    } else {
      console.error('Closing </section> not found before section 3!');
    }
  } else {
    console.error('section3Comment not found!');
  }
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Wrote file successfully! Final file length:', content.length);
