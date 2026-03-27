import { redirect } from "next/navigation";

export default function WorkoutHistoryRedirect() {
  redirect("/dashboard/workout-history");
}
