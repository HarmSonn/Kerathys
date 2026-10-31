// Loads every art file from public/art. A missing or broken file falls back
// to a plain coloured rectangle so the game never waits for art.

import { Assets, Graphics, Renderer, Texture } from "pixi.js";
import { artManifest } from "../data/art";

export type TextureMap = Map<string, Texture>;

/** Terrain images are also needed as plain images for compositing the ground. */
export type ImageMap = Map<string, HTMLImageElement>;

const base = `${import.meta.env.BASE_URL}art/`;

function fallback(renderer: Renderer, w: number, h: number): Texture {
  const g = new Graphics().rect(0, 0, w, h).fill({ color: 0xff00ff, alpha: 0.5 });
  return renderer.generateTexture(g);
}

export async function loadArt(renderer: Renderer, onProgress: (p: number) => void): Promise<{ textures: TextureMap; images: ImageMap }> {
  const files = artManifest();
  const textures: TextureMap = new Map();
  const images: ImageMap = new Map();
  let done = 0;
  await Promise.all(
    files.map(async (f) => {
      try {
        textures.set(f.path, await Assets.load<Texture>(base + f.path));
      } catch {
        console.warn(`Missing art: ${f.path}, using a placeholder`);
        textures.set(f.path, fallback(renderer, f.w, f.h));
      }
      if (f.kind === "terrain") {
        const img = new Image();
        img.src = base + f.path;
        await img.decode().catch(() => undefined);
        images.set(f.path, img);
      }
      onProgress(++done / files.length);
    }),
  );
  return { textures, images };
}
