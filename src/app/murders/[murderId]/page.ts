import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: { murderId: string };
}) {
  const murderId = (await params).murderId;
  redirect(`/murders/${murderId}/clues`);
}
