import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">That page does not exist.</p>
      <ButtonLink href="/" className="mt-6">
        Go to dashboard
      </ButtonLink>
    </div>
  );
}
