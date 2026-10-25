const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const o = await prisma.order.findFirst({
    select: {
      id: true,
      orderKind: true,
      customerMeatWeight: true,
      grillingFee: true,
      meatType: true,
      pricingMode: true,
      expectedPickupTime: true,
      receivedBy: true,
      deliveredBy: true,
      reprintCount: true,
      workflowStatus: true,
      statusHistory: true,
    }
  });
  console.log('Query successful, sample order:', o);

  const oi = await prisma.orderItem.findFirst({
    select: {
      id: true,
      weightGrams: true,
      rawWeightGrams: true,
      cookedWeightGrams: true,
      isCustomerMeat: true,
    }
  });
  console.log('Query successful, sample order item:', oi);

  await prisma.$disconnect();
  console.log('ALL NEW SCHEMA COLUMNS VERIFIED 100%!');
}

test().catch(e => {
  console.error('Error verifying schema:', e);
  process.exit(1);
});
