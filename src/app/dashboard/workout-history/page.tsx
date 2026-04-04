import { redirect } from "next/navigation";

export default function WorkoutHistoryRedirectPage() {
	redirect("/dashboard/train");
}
