import { createFileRoute } from "@tanstack/react-router";
import { UseCasePage, faqJsonLd, type UseCaseContent } from "@/components/UseCasePage";

const TITLE = "AR Wedding Invitations — Invites That Play a Save-the-Date Film";
const DESC =
  "Create AR wedding invitations: guests scan the printed invite and your save-the-date video plays over it. Built for Indian wedding printers and event agencies.";
const URL = "https://aetherphoto.shop/ar-wedding-invitations";

const content: UseCaseContent = {
  eyebrow: "Weddings & events",
  h1: "AR wedding invitations guests actually remember",
  intro:
    "Printed invitation cards are beautiful and silent. With Aether, the same card plays the couple's save-the-date film, venue walkthrough or family message the moment a guest scans it. Wedding printers and event agencies add it as a paid upgrade on invitation orders, with no AR subscription eating the margin.",
  steps: [
    { title: "Use the invite artwork", body: "The printed invitation itself becomes the tracked image." },
    { title: "Add the film", body: "Upload the save-the-date video, venue tour or family greeting." },
    { title: "Print one QR", body: "A single QR on the invite covers every card in the batch." },
    { title: "Guests scan", body: "The film plays over the invitation, full-screen on request." },
  ],
  bullets: [
    "Works for invites, RSVP cards, itineraries and welcome kits",
    "One QR can serve a multi-card invitation set",
    "No app install — guests of every age can use it",
    "Direct-video fallback when tracking conditions are poor",
    "Scan analytics to show the couple how many guests engaged",
  ],
  faqs: [
    {
      q: "How do AR wedding invitations work?",
      a: "The invitation design is compiled into an AR marker. Guests scan the QR, point the camera at the card, and the linked video plays anchored to it.",
    },
    {
      q: "Will it work for guests who are not tech-savvy?",
      a: "Yes. It is a normal camera scan followed by a browser page, and the video also plays directly if they never point at the card.",
    },
    {
      q: "Can we use different videos for different guest groups?",
      a: "Yes — print different QR codes per group, each pointing to its own experience.",
    },
  ],
};

export const Route = createFileRoute("/ar-wedding-invitations")({
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
