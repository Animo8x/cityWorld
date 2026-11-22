import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltRoughness: THREE.CanvasTexture;
  highwayMap: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  glassTowerMap: THREE.CanvasTexture;
  glassTowerEmissive: THREE.CanvasTexture;
  brickMap: THREE.CanvasTexture;
  brickEmissive: THREE.CanvasTexture;
  industrialMap: THREE.CanvasTexture;
  grassMap: THREE.CanvasTexture;
  sandMap: THREE.CanvasTexture;
  runwayMap: THREE.CanvasTexture;
  containerMap: THREE.CanvasTexture;
  supermarketSignMap: THREE.CanvasTexture;
  gunShopSignMap: THREE.CanvasTexture;
  skinShopSignMap: THREE.CanvasTexture;
  dealershipSignMap: THREE.CanvasTexture;
  apexDealerSignMap: THREE.CanvasTexture;
  houseSignMap: THREE.CanvasTexture;
  billboardTextures: THREE.CanvasTexture[];
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeTex(
  canvas: HTMLCanvasElement,
  maxAniso: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const all: THREE.Texture[] = [];

  // 1. Asphalt Road Texture
  const [asphC, asphCtx] = makeCanvas(512, 512);
  asphCtx.fillStyle = '#252930';
  asphCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4500; i++) {
    const shade = 30 + Math.floor(Math.random() * 24);
    asphCtx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
    asphCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  asphCtx.fillStyle = '#eab308';
  for (let y = 12; y < 512; y += 64) {
    asphCtx.fillRect(252, y, 8, 36);
  }
  asphCtx.fillStyle = '#cbd5e1';
  asphCtx.fillRect(22, 0, 6, 512);
  asphCtx.fillRect(484, 0, 6, 512);
  const asphaltMap = finalizeTex(asphC, maxAniso, true, 1, 1);
  all.push(asphaltMap);

  const [roughC, roughCtx] = makeCanvas(256, 256);
  roughCtx.fillStyle = '#c8c8c8';
  roughCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 28; i++) {
    const grad = roughCtx.createRadialGradient(
      Math.random() * 256,
      Math.random() * 256,
      4,
      Math.random() * 256,
      Math.random() * 256,
      36
    );
    grad.addColorStop(0, '#3a3a3a');
    grad.addColorStop(1, 'rgba(200,200,200,0)');
    roughCtx.fillStyle = grad;
    roughCtx.fillRect(0, 0, 256, 256);
  }
  const asphaltRoughness = finalizeTex(roughC, maxAniso, false, 1, 1);
  all.push(asphaltRoughness);

  // 2. Highway Texture
  const [hwyC, hwyCtx] = makeCanvas(512, 512);
  hwyCtx.fillStyle = '#1f242c';
  hwyCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3200; i++) {
    const shade = 26 + Math.floor(Math.random() * 18);
    hwyCtx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
    hwyCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  hwyCtx.fillStyle = '#f59e0b';
  hwyCtx.fillRect(249, 0, 5, 512);
  hwyCtx.fillRect(258, 0, 5, 512);
  hwyCtx.fillStyle = '#e2e8f0';
  for (let y = 10; y < 512; y += 64) {
    hwyCtx.fillRect(132, y, 5, 32);
    hwyCtx.fillRect(375, y, 5, 32);
  }
  hwyCtx.fillRect(16, 0, 7, 512);
  hwyCtx.fillRect(489, 0, 7, 512);
  const highwayMap = finalizeTex(hwyC, maxAniso, true, 1, 1);
  all.push(highwayMap);

  // 3. Concrete Sidewalk
  const [swC, swCtx] = makeCanvas(256, 256);
  swCtx.fillStyle = '#8b939e';
  swCtx.fillRect(0, 0, 256, 256);
  swCtx.strokeStyle = '#6f7782';
  swCtx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    swCtx.beginPath();
    swCtx.moveTo(x, 0);
    swCtx.lineTo(x, 256);
    swCtx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    swCtx.beginPath();
    swCtx.moveTo(0, y);
    swCtx.lineTo(256, y);
    swCtx.stroke();
  }
  const sidewalkMap = finalizeTex(swC, maxAniso, true, 8, 8);
  all.push(sidewalkMap);

  // 4. Glass Skyscraper Facade + Richer Night Emissive Map
  const [glC, glCtx] = makeCanvas(512, 512);
  const [emC, emCtx] = makeCanvas(512, 512);
  glCtx.fillStyle = '#1e293b';
  glCtx.fillRect(0, 0, 512, 512);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * 64 + 6;
      const y = row * 32 + 4;
      const w = 52;
      const h = 22;
      const tint = Math.random();
      glCtx.fillStyle = tint > 0.5 ? '#3b6d8f' : '#2c5270';
      glCtx.fillRect(x, y, w, h);
      glCtx.fillStyle = 'rgba(186,230,253,0.22)';
      glCtx.fillRect(x, y, w, 6);

      if (Math.random() > 0.25) {
        const warm = Math.random() > 0.3;
        emCtx.fillStyle = warm ? '#fde68a' : '#bae6fd';
        emCtx.fillRect(x + 2, y + 2, w - 4, h - 4);
      }
    }
  }
  const glassTowerMap = finalizeTex(glC, maxAniso, true, 1, 2);
  const glassTowerEmissive = finalizeTex(emC, maxAniso, true, 1, 2);
  all.push(glassTowerMap, glassTowerEmissive);

  // 5. Brick Tenement / Residential Texture + Aligned Glowing Night Windows
  const [brC, brCtx] = makeCanvas(256, 256);
  const [brEmC, brEmCtx] = makeCanvas(256, 256);
  brCtx.fillStyle = '#7c4338';
  brCtx.fillRect(0, 0, 256, 256);
  brEmCtx.fillStyle = '#000000';
  brEmCtx.fillRect(0, 0, 256, 256);

  for (let row = 0; row < 32; row++) {
    const offset = (row % 2) * 16;
    for (let col = -1; col < 9; col++) {
      const r = 110 + Math.floor(Math.random() * 30);
      const g = 58 + Math.floor(Math.random() * 18);
      const b = 48 + Math.floor(Math.random() * 14);
      brCtx.fillStyle = `rgb(${r},${g},${b})`;
      brCtx.fillRect(col * 32 + offset + 1, row * 8 + 1, 30, 6);
    }
  }
  for (let wy = 24; wy < 256; wy += 64) {
    for (let wx = 24; wx < 256; wx += 64) {
      brCtx.fillStyle = '#1e293b';
      brCtx.fillRect(wx, wy, 24, 34);
      brCtx.strokeStyle = '#cbd5e1';
      brCtx.lineWidth = 2;
      brCtx.strokeRect(wx, wy, 24, 34);

      if (Math.random() > 0.22) {
        brEmCtx.fillStyle = Math.random() > 0.25 ? '#fcd34d' : '#fef08a';
        brEmCtx.fillRect(wx + 2, wy + 2, 20, 30);
      }
    }
  }
  const brickMap = finalizeTex(brC, maxAniso, true, 2, 2);
  const brickEmissive = finalizeTex(brEmC, maxAniso, true, 2, 2);
  all.push(brickMap, brickEmissive);

  // 6. Industrial Corrugated Metal
  const [indC, indCtx] = makeCanvas(256, 256);
  indCtx.fillStyle = '#57534e';
  indCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 8) {
    indCtx.fillStyle = x % 16 === 0 ? '#68635d' : '#44403c';
    indCtx.fillRect(x, 0, 4, 256);
  }
  const industrialMap = finalizeTex(indC, maxAniso, true, 3, 2);
  all.push(industrialMap);

  // 7. Lush Grass Terrain
  const [grC, grCtx] = makeCanvas(256, 256);
  grCtx.fillStyle = '#3f6a34';
  grCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    grCtx.fillStyle = Math.random() > 0.5 ? '#4c7c3d' : '#325828';
    grCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const grassMap = finalizeTex(grC, maxAniso, true, 24, 24);
  all.push(grassMap);

  // 8. Beach Sand
  const [saC, saCtx] = makeCanvas(256, 256);
  saCtx.fillStyle = '#d6be8a';
  saCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    saCtx.fillStyle = Math.random() > 0.5 ? '#e3ce9d' : '#c2a773';
    saCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const sandMap = finalizeTex(saC, maxAniso, true, 12, 12);
  all.push(sandMap);

  // 9. Airport Runway
  const [rwC, rwCtx] = makeCanvas(512, 512);
  rwCtx.fillStyle = '#272b33';
  rwCtx.fillRect(0, 0, 512, 512);
  rwCtx.fillStyle = '#f8fafc';
  rwCtx.fillRect(16, 0, 8, 512);
  rwCtx.fillRect(488, 0, 8, 512);
  for (let y = 20; y < 512; y += 80) {
    rwCtx.fillRect(248, y, 16, 48);
  }
  const runwayMap = finalizeTex(rwC, maxAniso, true, 1, 6);
  all.push(runwayMap);

  // 10. Shipping Container Texture
  const [coC, coCtx] = makeCanvas(256, 128);
  coCtx.fillStyle = '#ffffff';
  coCtx.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 10) {
    coCtx.fillStyle = x % 20 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.1)';
    coCtx.fillRect(x, 0, 5, 128);
  }
  coCtx.strokeStyle = 'rgba(0,0,0,0.35)';
  coCtx.lineWidth = 6;
  coCtx.strokeRect(3, 3, 250, 122);
  const containerMap = finalizeTex(coC, maxAniso, true, 1, 1);
  all.push(containerMap);

  // 11. Supermarket illuminated storefront sign
  const [smC, smCtx] = makeCanvas(512, 128);
  smCtx.fillStyle = '#064e3b';
  smCtx.fillRect(0, 0, 512, 128);
  smCtx.strokeStyle = '#34d399';
  smCtx.lineWidth = 8;
  smCtx.strokeRect(6, 6, 500, 116);
  smCtx.fillStyle = '#ffffff';
  smCtx.font = 'bold 42px sans-serif';
  smCtx.textAlign = 'center';
  smCtx.fillText('CITYWORLD MARKET 24/7', 256, 62);
  smCtx.fillStyle = '#fde047';
  smCtx.font = 'bold 22px sans-serif';
  smCtx.fillText('SUPERMARKET · FOOD · ENERGY · SUPPLIES', 256, 102);
  const supermarketSignMap = finalizeTex(smC, maxAniso, true, 1, 1);
  all.push(supermarketSignMap);

  const makeStoreSign = (bg: string, border: string, title: string, sub: string) => {
    const [c, ctx] = makeCanvas(512, 128);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = border;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 60);
    ctx.fillStyle = border;
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(sub, 256, 100);
    const tex = finalizeTex(c, maxAniso, true, 1, 1);
    all.push(tex);
    return tex;
  };
  const gunShopSignMap = makeStoreSign('#450a0a', '#ef4444', 'CW TACTICAL ARMORY', 'PISTOLS · SHOTGUNS · RIFLES · RPG');
  const skinShopSignMap = makeStoreSign('#2e1065', '#facc15', 'LUXE COUTURE & SKINS', 'OUTFITS · CYBER · 24K GOLD SKIN');
  const dealershipSignMap = makeStoreSign('#0f172a', '#38bdf8', 'PREMIER MOTORS', 'CARS OVER $1000 · WEAK TO 342 KM/H');
  const apexDealerSignMap = makeStoreSign('#1c1917', '#f59e0b', 'APEX AUTO SHOWROOM', 'SUPERCAR · SPORTS · BIKES · TUNING');
  const houseSignMap = makeStoreSign('#431407', '#fb923c', 'HOME FOR SALE · $5,500+', 'KITCHEN FOOD · BEDROOM SLEEP · SAFE');

  // 12. Billboards
  const ads = [
    { bg: '#0f172a', accent: '#38bdf8', title: 'CITYWORLD', sub: 'METRO TRANSIT · EXPRESS' },
    { bg: '#1e1b4b', accent: '#f59e0b', title: 'VELOCE MOTORS', sub: 'TEST DRIVE DOWNTOWN' },
    { bg: '#064e3b', accent: '#34d399', title: 'AZURE COAST', sub: 'RESORT & BOARDWALK' },
  ];
  const billboardTextures = ads.map((ad) => {
    const [bc, bctx] = makeCanvas(512, 256);
    bctx.fillStyle = ad.bg;
    bctx.fillRect(0, 0, 512, 256);
    bctx.strokeStyle = ad.accent;
    bctx.lineWidth = 10;
    bctx.strokeRect(12, 12, 488, 232);
    bctx.fillStyle = '#ffffff';
    bctx.font = 'bold 54px sans-serif';
    bctx.textAlign = 'center';
    bctx.fillText(ad.title, 256, 125);
    bctx.fillStyle = ad.accent;
    bctx.font = 'bold 24px sans-serif';
    bctx.fillText(ad.sub, 256, 178);
    const t = finalizeTex(bc, maxAniso, true, 1, 1);
    all.push(t);
    return t;
  });

  return {
    asphaltMap,
    asphaltRoughness,
    highwayMap,
    sidewalkMap,
    glassTowerMap,
    glassTowerEmissive,
    brickMap,
    brickEmissive,
    industrialMap,
    grassMap,
    sandMap,
    runwayMap,
    containerMap,
    supermarketSignMap,
    gunShopSignMap,
    skinShopSignMap,
    dealershipSignMap,
    apexDealerSignMap,
    houseSignMap,
    billboardTextures,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
