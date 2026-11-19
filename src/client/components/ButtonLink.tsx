import { createLink, type LinkComponent } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { buttonVariants } from "@/client/components/ui/button";

type AnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof buttonVariants>;

/** A link that looks like a button: a plain anchor with the button's classes. */
export const ButtonAnchor = forwardRef<HTMLAnchorElement, AnchorProps>(function ButtonAnchor(
  { variant, size, className, ...props },
  ref,
) {
  return <a ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

const RouterButtonLink = createLink(ButtonAnchor);

/** A router link that looks like a button. */
export const ButtonLink: LinkComponent<typeof ButtonAnchor> = (props) => <RouterButtonLink preload="intent" {...props} />;
