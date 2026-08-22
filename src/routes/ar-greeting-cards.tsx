import { createFileRoute } from "@tanstack/react-router";
import { UseCasePage, faqJsonLd, type UseCaseContent } from "@/components/UseCasePage";

const TITLE = "AR Greeting Cards — Printed Cards That Play a Video Message";
const DESC =
  "Sell AR greeting cards: the recipient scans the card and your video message plays over it. Aether AR gives print and gift businesses the full platform for a one-time licence.";
const URL = "https://aetherphoto.shop/ar-greeting-cards";

const content: UseCaseContent = {
  eyebrow: "Gifting & print",
  h1: "AR greeting cards that carry a real video message",
  intro:
    "A birthday, anniversary or festival card becomes a personal film. The buyer records a message, you link it to the printed card artwork, and the recipient sees it play over the card the moment they scan. Aether handles marker compilation, hosting, QR codes and the customer-facing viewer so gift and print businesses can launch an AR card line without building anything.",
  steps: [
    {
      title: "Design the card",
      body: "Any printed artwork with enough visual detail works as the AR marker.",
    },
    {
      title: "Attach the message",
      body: "Upload the customer's video or greeting clip against that artwork.",
    },
    {
      title: "Print the QR",
      body: "A small QR on the back of the card is all the recipient needs.",
    },
    {
      title: "Scan and play",
      body: "The message plays over the card, with replay, mute and full-screen.",
    },
  ],
  bullets: [
    "Per-card personalised video without a mobile app",
    "Bulk album mode: one QR can serve a whole card set",
    "Playback and download controls for the recipient",
    "Simple admin dashboard your staff can run",
    "Runs on your own hosting — no per-card platform fee",
  ],
  faqs: [
    {
      q: "How do AR greeting cards work?",
      a: "The printed card artwork is registered as an image marker. When the recipient scans the QR and points their camera at the card, the linked video plays anchored to the artwork.",
    },
    {
      q: "Can each customer have a different video on the same card design?",
      a: "Yes. Each order gets its own QR code and its own linked media, even when the printed design is identical.",
    },
    {
      q: "How long does the video stay available?",
      a: "As long as you keep it in your storage. You control retention because the deployment is yours.",
    },
  ],
};

export const Route = createFileRoute("/ar-greeting-cards")({
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
