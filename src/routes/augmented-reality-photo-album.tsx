import { createFileRoute } from "@tanstack/react-router";
import { UseCasePage, faqJsonLd, type UseCaseContent } from "@/components/UseCasePage";

const TITLE = "Augmented Reality Photo Album — Make Printed Photos Play Video";
const DESC =
  "Build an augmented reality photo album: scan a printed photo with your phone and the video plays over it. White-label AR photo platform, one-time licence, no monthly fees.";
const URL = "https://aetherphoto.shop/augmented-reality-photo-album";

const content: UseCaseContent = {
  eyebrow: "AR photo albums",
  h1: "Augmented reality photo albums for print studios and gift shops",
  intro:
    "An augmented reality photo album is an ordinary printed album with a hidden layer: point a phone at any page and the moment behind the photo starts playing. Aether gives print shops, photo studios and gift stores the full stack to sell these — marker compiler, hosted viewer, QR generator and an admin dashboard — as a one-time purchase instead of a per-scan subscription.",
  steps: [
    { title: "Add photos and clips", body: "Upload each printed image with the video, message or slideshow it should trigger." },
    { title: "Generate the QR", body: "Aether produces a single QR code per album, ready to print on a card or the cover." },
    { title: "Customer scans", body: "Their browser opens the AR viewer and asks once for camera access." },
    { title: "The photo comes alive", body: "The clip is overlaid on the print, with playback controls and full-screen mode." },
  ],
  bullets: [
    "In-browser marker compiler — no external AR platform account",
    "Supports video, muted loops and full-screen fallback playback",
    "Per-photo analytics for identification rate and completion rate",
    "Marker accuracy testing tools for distance, angle, glare and low light",
    "Your storage, your domain, your pricing to end customers",
    "Deployed once, owned forever — no per-experience licensing",
  ],
  faqs: [
    {
      q: "What is an augmented reality photo album?",
      a: "It is a printed photo album where each page acts as an AR marker. A phone camera recognises the printed image and plays the linked video on top of it.",
    },
    {
      q: "Does it work on iPhone and Android?",
      a: "Yes. It runs in the mobile browser on both, including iOS Safari, with a tap-to-enable step for reliable autoplay.",
    },
    {
      q: "What print quality is needed?",
      a: "Standard matte or lightly glossy prints at 300 DPI work best. Highly reflective lamination reduces tracking accuracy.",
    },
    {
      q: "Is there a per-scan cost?",
      a: "No. You host the instance yourself, so the only ongoing cost is your own hosting and storage.",
    },
  ],
};

export const Route = createFileRoute("/augmented-reality-photo-album")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(faqJsonLd(content.faqs)) }],
  }),
  component: () => <UseCasePage content={content} />,
});
