"use client";

import { type ReactNode } from "react";

type AlertButtonProps = {
  appName: string;
  children: ReactNode;
  className?: string;
};

export function AlertButton({
  appName,
  children,
  className,
}: AlertButtonProps) {
  return (
    <button
      className={className}
      onClick={() => window.alert(`Hello from your ${appName} app!`)}
    >
      {children}
    </button>
  );
}
