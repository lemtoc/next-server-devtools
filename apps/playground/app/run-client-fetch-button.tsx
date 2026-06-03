"use client";

import { useState } from "react";

type RunClientFetchButtonProps = {
  className?: string;
};

export function RunClientFetchButton({ className }: RunClientFetchButtonProps) {
  const [isPending, setIsPending] = useState(false);

  const runClientFetch = async () => {
    setIsPending(true);

    try {
      await fetch("/api/playground/upstream?token=client-secret&query=visible", {
        headers: {
          Authorization: "Bearer client-secret",
          "x-playground": "client",
        },
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button className={className} disabled={isPending} onClick={runClientFetch} type="button">
      {isPending ? "Running..." : "Run client fetch"}
    </button>
  );
}
