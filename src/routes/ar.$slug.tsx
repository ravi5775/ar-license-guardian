import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ArrowLeft, Camera, Play } from "lucide-react";

const getExperienceBySlug = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string() }).parse(raw))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: row } = await sb
      .from("ar_experiences")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    return row;
  });

export const Route = createFileRoute("/ar/$slug")({
  loader: async ({ params }) => {
    const row = await getExperienceBySlug({ data: { slug: params.slug } });
    if (!row) throw notFound();
    return { experience: row };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.experience.title} — AR Experience` },
          { name: "description", content: loaderData.experience.description ?? "View this AR experience" },
          { property: "og:title", content: loaderData.experience.title },
          {
            property: "og:description",
            content: loaderData.experience.description ?? "View this AR experience",
          },
          ...(loaderData.experience.cover_image_url
            ? [
                { property: "og:image", content: loaderData.experience.cover_image_url },
                { name: "twitter:image", content: loaderData.experience.cover_image_url },
              ]
            : []),
        ]
      : [],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
      <div>
        <h1 className="text-2xl font-serif italic mb-2">Couldn't load experience</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
      <div>
        <h1 className="text-3xl font-serif italic mb-2">Experience not found</h1>
        <p className="text-sm text-muted-foreground mb-6">This AR link doesn't exist or isn't published.</p>
        <Link to="/" className="text-primary hover:underline text-sm">← Back to home</Link>
      </div>
    </div>
  ),
  component: ARViewer,
});

function ARViewer() {
  const { experience } = Route.useLoaderData();
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!started) return;
    // Placeholder: In production we'd load MindAR + A-Frame from CDN and mount the scene
    // For now we render a live camera feed with the media overlaid, so the flow is testable.
  }, [started]);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <Link
        to="/"
        className="absolute top-4 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-xs hover:bg-white/20"
      >
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>

      {!started ? (
        <div className="min-h-screen grid place-items-center p-6">
          <div className="max-w-md text-center">
            {experience.cover_image_url && (
              <img src={experience.cover_image_url} alt="" className="w-full aspect-video object-cover rounded-2xl mb-6" />
            )}
            <h1 className="text-3xl font-serif italic mb-2">{experience.title}</h1>
            {experience.description && (
              <p className="text-sm text-white/70 mb-6">{experience.description}</p>
            )}
            <button
              onClick={() => setStarted(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-medium hover:bg-white/90"
            >
              <Camera className="h-4 w-4" />
              Launch AR
            </button>
            <p className="text-xs text-white/40 mt-4">
              Your camera stays on your device. Point at the printed marker to see the AR content.
            </p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-screen">
          <ARStage experience={experience} />
        </div>
      )}
    </div>
  );
}

function ARStage({ experience }: { experience: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div>
          <p className="text-lg mb-2">Camera access needed</p>
          <p className="text-sm text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="w-64 h-64 border-2 border-white/60 rounded-2xl relative">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs bg-white/10 backdrop-blur px-3 py-1 rounded-full whitespace-nowrap">
            Point at the marker
          </div>
        </div>
      </div>
      {experience.media_url && experience.media_type === "video" && (
        <video
          src={experience.media_url}
          autoPlay={experience.autoplay}
          loop={experience.loop_playback}
          playsInline
          className="absolute inset-x-8 bottom-20 max-w-md mx-auto rounded-2xl shadow-2xl opacity-95"
        />
      )}
      {experience.media_url && experience.media_type === "image" && (
        <img
          src={experience.media_url}
          alt=""
          className="absolute inset-x-8 bottom-20 max-w-md mx-auto rounded-2xl shadow-2xl opacity-95"
        />
      )}
      <div className="absolute bottom-6 inset-x-0 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-2 text-xs">
          <Play className="h-3 w-3" />
          {experience.title}
        </div>
      </div>
    </div>
  );
}
