import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <Workspace
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}
