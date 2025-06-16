import { db } from "@/db";
import { cookies } from "next/headers";
import MurderTable from "@/components/MurderTable";
import { Murder } from "@/db/models/murders";

export default async function Page() {
  const murders = (await db.query.murders.findMany()) as Murder[];

  const cookieStore = await cookies();
  const userToken = cookieStore.get("user_token")?.value;
  if (!userToken) {
    throw new Error("User token not found");
  }

  return <MurderTable murders={murders} userToken={userToken} />;
}
