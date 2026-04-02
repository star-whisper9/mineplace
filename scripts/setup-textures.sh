#!/usr/bin/env bash
# Copy needed textures from Bedrock resource pack to public/textures/
set -euo pipefail

SRC="dev-docs/resource_pack/textures/blocks"
DST="public/textures/blocks"

mkdir -p "$DST"

# --- Block textures ---
cp "$SRC/dirt.png" "$DST/"
cp "$SRC/grass_top.png" "$DST/"
cp "$SRC/grass_side_carried.png" "$DST/"
cp "$SRC/farmland_wet.png" "$DST/"
cp "$SRC/farmland_dry.png" "$DST/"
cp "$SRC/water_still_grey.png" "$DST/"
cp "$SRC/water_flow_grey.png" "$DST/"

# --- Wheat (8 stages) ---
for i in $(seq 0 7); do
  cp "$SRC/wheat_stage_${i}.png" "$DST/"
done

# --- Carrots (4 stages: 0-2 + 3) ---
for i in $(seq 0 3); do
  cp "$SRC/carrots_stage_${i}.png" "$DST/"
done

# --- Sweet berry bush (4 stages) ---
for i in $(seq 0 3); do
  cp "$SRC/sweet_berry_bush_stage${i}.png" "$DST/"
done

echo "✅ Textures copied to $DST"

# --- Fish entity textures ---
FISH_SRC="dev-docs/resource_pack/textures/entity/fish"
FISH_DST="public/textures/entity/fish"
mkdir -p "$FISH_DST"

cp "$FISH_SRC/cod.png" "$FISH_DST/"
cp "$FISH_SRC/salmon.png" "$FISH_DST/"
cp "$FISH_SRC/pufferfish.png" "$FISH_DST/"

echo "✅ Fish textures copied to $FISH_DST"

# --- Item textures ---
ITEM_SRC="dev-docs/resource_pack/textures/items"
ITEM_DST="public/textures/items"
mkdir -p "$ITEM_DST"

cp "$ITEM_SRC/wheat.png" "$ITEM_DST/"
cp "$ITEM_SRC/carrot.png" "$ITEM_DST/"
cp "$ITEM_SRC/sweet_berries.png" "$ITEM_DST/"

echo "✅ Item textures copied to $ITEM_DST"

# --- Particle textures ---
PARTICLE_SRC="dev-docs/resource_pack/textures/particle"
PARTICLE_DST="public/textures/particle"
mkdir -p "$PARTICLE_DST"

cp "$PARTICLE_SRC/particles.png" "$PARTICLE_DST/"

echo "✅ Particle textures copied to $PARTICLE_DST"
