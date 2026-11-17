# Ressources 3D

## avatar.glb — personnage humanoïde

- **Origine** : avatar « Ready Player Me » fourni comme exemple dans le dépôt three.js
  (`examples/models/gltf/readyplayer.me.glb`, tag r170), récupéré sans modification.
- **Contenu** : maillage skinné (67 os, squelette compatible Mixamo, mains à cinq doigts), textures PBR, deux cibles de morphing
  du visage (`mouthOpen`, `mouthSmile`). Les métadonnées du fichier indiquent « Ready Player Me » comme détenteur des droits.
- **Conditions** : les avatars Ready Player Me sont proposés aux développeurs pour un **usage non commercial** sous licence
  [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Ce projet est un jeu pédagogique non commercial ; toute
  utilisation commerciale nécessite de remplacer ce fichier par un avatar dont vous détenez les droits (le code accepte tout
  GLB à squelette Mixamo / Ready Player Me : voir `src/lib/three/character/assets.ts`).
- **Modifications faites au chargement (en mémoire, le fichier n'est pas modifié)** : retrait du chapeau, de la fleur et du nœud
  papillon d'origine ; recoloration du costume ; ajout par code des cheveux, de la cravate, des lunettes, de la montre et des paupières.

## Animations

Aucune animation externe n'est utilisée : marche, course, rotation, gestes, assise, regard et clignements sont générés en direct
par `src/lib/three/character/animator.ts` (cinématique inverse des jambes, gestes par directions de bras).

## Décors

Hall de la banque, ascenseurs, atelier du tailleur : modélisés par code (`src/lib/three/world.ts`), sans fichier externe.
