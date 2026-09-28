import { redirect } from "next/navigation";

/** Old /pricing URL → Buy me a coffee */
export default function PricingRedirect() {
  redirect("/coffee");
}
