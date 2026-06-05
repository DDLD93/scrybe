import { getBrandingStyles } from "@/lib/branding";

export function BrandStyles() {
  return <style dangerouslySetInnerHTML={{ __html: getBrandingStyles() }} />;
}
