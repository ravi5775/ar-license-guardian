import { createFileRoute } from "@tanstack/react-router";
import { UseCasePage, faqJsonLd, type UseCaseContent } from "@/components/UseCasePage";

const TITLE = "Wedding AR Albums — One QR, Your Whole Wedding Film | Aether AR";
const DESC =
  "Turn wedding photos into augmented reality albums. Guests scan one QR code on a printed photo and the wedding video plays over it. Built for Indian wedding photographers.";
const URL = "https://aetherphoto.shop/wedding-ar-albums";

const content: UseCaseContent = {
  eyebrow: "Wedding photography",
  h1: "Wedding AR albums that play the moment, not just show it",
  intro:
    "An Aether wedding AR album links every printed photograph to the video clip it came from. The couple points a phone camera at a page, the still is recognised in under a second, and the film plays right on top of the print — no app install, no per-scan fee. Photographers in India use it as a premium add-on to wedding album packages.",
  steps: [
    {
      title: "Upload the album",
      body: "Add up to 20 photos and their matching video clips in the admin dashboard.",
    },
    {
      title: "Compile one marker",
      body: "Aether compiles all photos into a single AR marker file, so one QR code covers the whole album.",
    },
    {
      title: "Print and hand over",
      body: "Print the QR on the album cover or invite card. Guests scan with any phone camera.",
    },
    {
      title: "Watch it play",
      body: "Each recognised photo plays its own clip, with fit-to-screen, replay and download controls.",
    },
  ],
  bullets: [
    "One QR code for an entire wedding album — up to 20 tracked photos",
    "Works in the mobile browser: no app download for guests",
    "Video plays anchored to the print, or full-screen for older phones",
    "Scan analytics: which photos get recognised and watched to the end",
    "White-label: your studio branding, your domain, your storage",
    "One-time licence — you own the deployment, no monthly AR platform bills",
  ],
  faqs: [
    {
      q: "Do guests need to install an AR app?",
      a: "No. The experience runs in Safari or Chrome on any modern phone. Scanning the QR opens the AR viewer directly.",
    },
    {
      q: "How many photos can one wedding AR album hold?",
      a: "Up to 20 tracked photos per compiled marker. Larger weddings can be split across multiple albums, each with its own QR.",
    },
    {
      q: "What if the lighting at the venue is poor?",
      a: "If tracking is unreliable the viewer automatically falls back to direct video playback, so the clip always plays.",
    },
    {
      q: "Can I resell this to my clients under my own brand?",
      a: "Yes. Aether is sold as a white-label instance with a one-time licence, deployed to your own infrastructure.",
    },
  ],
};

export const Route = createFileRoute("/wedding-ar-albums")({
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
