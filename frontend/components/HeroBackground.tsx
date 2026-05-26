"use client";

const POSTER_URLS = [
  "https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  "https://image.tmdb.org/t/p/w342/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
  "https://image.tmdb.org/t/p/w342/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
  "https://image.tmdb.org/t/p/w342/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
  "https://image.tmdb.org/t/p/w342/3bhkrj58Vtu7enYsLeMLoG7XDed.jpg",
  "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  "https://image.tmdb.org/t/p/w342/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
  "https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  "https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
  "https://image.tmdb.org/t/p/w342/ow3wq89wM8qd5X7hWKxiRfsFf9C.jpg",
  "https://image.tmdb.org/t/p/w342/kuf6dutpsT0vSVehic3EZIqkOBt.jpg",
  "https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
];

interface Props {
  overridePoster?: string | null;
}

export default function HeroBackground({ overridePoster }: Props) {
  if (overridePoster) {
    return (
      <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--color-bg)] transition-colors duration-500">
        {/* Animated Background Orbs (Cinematic Blur) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute w-[500px] h-[500px] rounded-full blur-[130px] -top-40 -right-20 animate-orb-1 transition-all duration-700" 
            style={{ backgroundColor: "var(--color-orb-1)", opacity: 0.12 }}
          />
          <div 
            className="absolute w-[450px] h-[450px] rounded-full blur-[120px] -bottom-20 -left-20 animate-orb-2 transition-all duration-700" 
            style={{ backgroundColor: "var(--color-orb-2)", opacity: 0.10 }}
          />
        </div>
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            backgroundImage: `url(${overridePoster})`,
            filter: "blur(40px) brightness(0.22)",
            transition: "background-image 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg)]/60 via-transparent to-[var(--color-bg)]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--color-bg)] transition-colors duration-500">
      {/* Animated Background Orbs (Cinematic Blur) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-[600px] h-[600px] rounded-full blur-[140px] -top-60 -right-20 animate-orb-1 transition-all duration-700" 
          style={{ backgroundColor: "var(--color-orb-1)", opacity: 0.10 }}
        />
        <div 
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] bottom-10 left-10 animate-orb-2 transition-all duration-700" 
          style={{ backgroundColor: "var(--color-orb-2)", opacity: 0.08 }}
        />
        <div 
          className="absolute w-[400px] h-[400px] rounded-full blur-[100px] top-1/3 left-1/3 animate-orb-3 transition-all duration-700" 
          style={{ backgroundColor: "var(--color-orb-3)", opacity: 0.08 }}
        />
      </div>

      {/* Grid of Posters */}
      <div className="animate-slow-pan absolute inset-0 grid grid-cols-4 gap-1.5 opacity-[0.14] scale-105 pointer-events-none">
        {POSTER_URLS.map((url) => (
          <div
            key={url}
            className="relative overflow-hidden rounded-md border border-white/[0.02]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover select-none"
              style={{ minHeight: "33vh" }}
            />
          </div>
        ))}
      </div>

      {/* Cinematic Vignettes */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg)]/90 via-[var(--color-bg)]/65 to-[var(--color-bg)] transition-all duration-500" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-bg)]/60 via-transparent to-[var(--color-bg)]/60 transition-all duration-500" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,var(--color-bg)_95%)] transition-all duration-500" />
    </div>
  );
}
