import { redirect } from "next/navigation";

// The case-study landing page is built in Milestone 7. Until then, the root
// sends visitors straight into the working product.
export default function HomePage() {
  redirect("/library");
}
