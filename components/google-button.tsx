"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signInWithGoogle, type AuthFormState } from "@/app/(auth)/actions";

/**
 * Google's "G" mark, inlined.
 *
 * Google's branding terms require their own logo on the button, so this is the
 * one place the project uses a non-lucide icon (DESIGN.md). Inline rather than
 * a remote asset so it never costs a request and cannot fail to load.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
      />
    </svg>
  );
}

function GoogleSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      disabled={pending}
      className="h-11 w-full text-sm"
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <GoogleMark className="size-[18px]" />
      )}
      Continue with Google
    </Button>
  );
}

/**
 * Starts the Google OAuth handshake.
 *
 * A form + server action rather than a client-side `signInWithOAuth` call, so
 * the redirect target is built on the server and works with JS disabled.
 */
export function GoogleButton({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    signInWithGoogle,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <GoogleSubmit />
    </form>
  );
}
