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
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            backgroundImage: `url(${overridePoster})`,
            filter: "blur(40px) brightness(0.25)",
            transition: "background-image 1s ease",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#08080f]/60 via-transparent to-[#08080f]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="animate-slow-pan absolute inset-0 grid grid-cols-4 gap-1 opacity-20 scale-110">
        {POSTER_URLS.map((url, i) => (
          <div
            key={i}
            className="relative overflow-hidden"
            style={{ animationDelay: `${i * 0.3}s` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover"
              style={{ minHeight: "33vh" }}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#08080f]/80 via-[#08080f]/60 to-[#08080f]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#08080f]/40 via-transparent to-[#08080f]/40" />
    </div>
  );
}
