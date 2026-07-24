import { createFileRoute } from "@tanstack/react-router";
import { UseCasePage, faqJsonLd, type UseCaseContent } from "@/components/UseCasePage";

const TITLE = "AR Business Cards — Scan the Card, Watch the Pitch | Aether AR";
const DESC =
  "Turn business cards into augmented reality experiences: scan the card and a video intro, portfolio or product demo plays over it. White-label AR platform, one-time licence.";
const URL = "https://aetherphoto.shop/ar-business-cards";

const content: UseCaseContent = {
  eyebrow: "Brand & sales",
  h1: "AR business cards that pitch for you after the handshake",
  intro:
    "A printed card is a dead end; an AR business card is a 30-second introduction. Scan it and a founder intro, showreel or product demo plays over the card in the browser. Print shops and agencies use Aether to sell AR cards to real-estate brokers, consultants, studios and event exhibitors — priced per card, delivered from your own instance.",
  steps: [
    { title: "Register the card art", body: "Upload the card front as the tracked image." },
    { title: "Link the video", body: "Attach an intro, portfolio reel or product demo clip." },
    { title: "Print the QR", body: "Add the QR to the reverse side so first-time scanners know what to do." },
    { title: "Play anywhere", body: "The video plays over the card, or full-screen if the contact prefers." },
  ],
  bullets: [
    "One tracked card design per client, unlimited scans",
    "No app install for the person receiving the card",
    "Scan analytics show how often a card actually gets used",
    "Swap the linked video any time without reprinting",
    "Your branding on the viewer page",
  ],
  faqs: [
    {
      q: "What is an AR business card?",
      a: "A normal printed business card whose front is registered as an image marker. Scanning it with a phone plays a linked video over the card.",
    },
    {
      q: "Can I change the video after the cards are printed?",
      a: "Yes. The QR points to a slug you control, so you can replace the media at any time.",
    },
    {
      q: "Does it need special card stock?",
      a: "No, but avoid high-gloss lamination and keep the design visually distinctive for reliable tracking.",
    },
  ],
};

export const Route = createFileRoute("/ar-business-cards")({
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
