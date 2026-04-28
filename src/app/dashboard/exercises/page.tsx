import { redirect } from "next/navigation";

export default function ExercisesCanvasPage() {
  redirect("/dashboard/train?library=1");
}
