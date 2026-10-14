import { getCustomers } from "@/actions/customers";
import CustomersView from "./customers-view";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const result = await getCustomers();
  const customers = result.customers || [];

  return <CustomersView initialCustomers={customers} />;
}
