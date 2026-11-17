import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Chemin d'un fichier du dossier public/ (compatible avec l'édition navigateur publiée dans un sous-dossier) */
export const assetUrl = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

/**
 * Modèle humanoïde : avatar Ready Player Me (GLB, squelette compatible Mixamo, 67 os, mains à 5 doigts, textures PBR).
 * Source : exemple `readyplayer.me.glb` du dépôt three.js. Voir public/models/LICENSES.md pour les conditions d'utilisation.
 */
export const AVATAR_GLB = "/models/avatar.glb";

let cache: Promise<GLTF> | null = null;
/** Charge le modèle une seule fois ; chaque personnage en reçoit ensuite un clone indépendant */
export function loadAvatarGltf(): Promise<GLTF> {
  if (!cache) {
    const loader = new GLTFLoader();
    cache = loader.loadAsync(assetUrl(AVATAR_GLB)).catch((e) => { cache = null; throw e; });
  }
  return cache;
}
export type { GLTF };
export const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => (o as THREE.SkinnedMesh).isSkinnedMesh === true;
