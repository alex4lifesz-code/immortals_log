import { redirect } from "next/navigation";

export default function WorkoutPageRedirect() {
  redirect("/dashboard/workout-history");
}

