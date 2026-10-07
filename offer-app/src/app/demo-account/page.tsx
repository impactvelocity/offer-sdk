import { redirect } from "next/navigation";

// A link to hand out: sign-in with the demo login filled in.
export default function DemoAccountPage() {
  redirect("/sign-in?demo");
}
