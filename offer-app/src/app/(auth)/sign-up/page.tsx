import { redirect } from "next/navigation";

// Sign-up is the one-time admin setup now (/setup sends you to sign-in once it's done).
export default function SignUpPage() {
  redirect("/setup");
}
