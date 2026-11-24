import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rigging Rentals",
    short_name: "Rigging",
    description: "Equipment rental operations for sales, workshop, and finance",
    start_url: "/login",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#f5d400",
    icons: [
      {
        src: "/icon",
        sizes: "48x48",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
