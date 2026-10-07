import Image from "next/image";
import dylan from "@/assets/dylan.png";
import { cn } from "@/lib/utils";

// Byline under the hero CTAs, as on dolly.dev: photo, name, role and social links.
const links = [
  { href: "https://hidylanjones.com", label: "Site" },
  { href: "https://www.linkedin.com/in/hidylanjones", label: "LinkedIn" },
  { href: "https://twitter.com/hidylanjones", label: "Twitter" },
];

export function CreatorCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Image
        src={dylan}
        alt="Dylan Jones"
        width={64}
        height={64}
        placeholder="blur"
        className="size-16 shrink-0 rounded-full object-cover ring-2 ring-border-strong ring-offset-2 ring-offset-canvas"
      />
      <div className="min-w-0">
        <p className="text-base font-medium text-fg">Dylan Jones</p>
        <p className="text-sm text-fg-secondary">Creator of OfferSDK.com</p>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tracking-wide">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="focus-ring rounded-sm text-fg-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-fg"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
