import { redirect } from "next/navigation";

export default function OverviewRedirectPage() {
	redirect("/dashboard/check-in");
}
