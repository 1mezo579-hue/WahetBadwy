import { getUsers } from "@/actions/users";
import UsersView from "./users-view";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const result = await getUsers();
  const users = result.users || [];

  return <UsersView initialUsers={users} />;
}
