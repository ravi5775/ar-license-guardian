/**
 * Central media configuration for the Aether landing page + live workflow demo.
 *
 * Video assets are self-hosted on the Lovable CDN (originally sourced from
 * mixkit.co, free for commercial use) so external stock CDNs can never break
 * the hero. Still photography is served from Unsplash's image CDN with
 * width/quality transforms applied.
 *
 * Replace any entry here with Aether-owned assets later — nothing else in the
 * codebase should hardcode a media URL.
 */
import heroLoop from "@/assets/hero-loop.mp4.asset.json";
import heroPoster from "@/assets/hero-poster.jpg.asset.json";
import portalLoop from "@/assets/portal-hero.mp4.asset.json";
import portalPoster from "@/assets/portal-hero.jpg.asset.json";

import phoneScan from "@/assets/phone-scan.jpg";

const unsplash = (id: string, w = 2000, q = 82) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=${q}`;

export const workflowMedia = {
  /** Slow cinematic wedding ceremony loop — hero background */
  heroVideo: heroLoop.url,
  heroPoster: heroPoster.url,

  /** The "film" that plays out of the printed photo */
  weddingVideo: portalLoop.url,
  weddingVideoPoster: portalPoster.url,

  /** Trigger image used as the printed photograph in the workflow */
  weddingPhoto: unsplash("photo-1583939003579-730e3918a45a", 1600),
  weddingPhotoLarge: unsplash("photo-1583939003579-730e3918a45a", 2400, 85),

  /** Workflow / how-it-works stage stills */
  uploadShot: unsplash("photo-1498050108023-c5249f4df085", 1800),
  printedInvitation: unsplash("photo-1606216794074-735e91aa2c92", 1800),
  phoneScanShot: phoneScan,

  /** Use-case card imagery */
  albumPhoto: unsplash("photo-1511285560929-80b456fea0bc", 1600),
  greetingCard: unsplash("photo-1580136579312-94651dfd596d", 1600),
  businessCard: unsplash("photo-1544006659-f0b21884ce1d", 1600),
  invitationCard: unsplash("photo-1606216794074-735e91aa2c92", 1600),
  museumImage: unsplash("photo-1502920917128-1aa500764cbd", 1600),
  realEstateImage: unsplash("photo-1560518883-ce09059eeffa", 1600),
  weddingRings: unsplash("photo-1523438885200-e635ba2c371e", 1600),
} as const;


export const demoScanUrl = "https://aetherphoto.shop/ar/album/demo-wedding-001";
