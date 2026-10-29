import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gowes-gaskeun.aaaiiimmm.dev";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/event",
          "/tikum",
          "/live",
        ],
        disallow: [
          "/admin",
          "/admin/*",
          "/dashboard",
          "/dashboard/*",
          "/profile",
          "/profile/*",
          "/login",
          "/register",
          "/api/*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
