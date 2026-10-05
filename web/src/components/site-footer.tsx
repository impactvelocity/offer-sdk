export function SiteFooter() {
  return (
    <footer className="border-t border-black/10 py-8 text-center text-sm text-foreground/60 dark:border-white/10">
      © {new Date().getFullYear()} Offer
    </footer>
  );
}
