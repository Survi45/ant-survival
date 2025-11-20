class Ant {
  constructor(opts){
    this.x = opts.x;
    this.y = opts.y;
    this.type = opts.type || "normal";
    this.size = opts.size || 28;
    this.baseSpeed = opts.speed || 1.2;
    this.direction = opts.direction || -1;
    this.speed = this.baseSpeed * (this.type === "gold" ? 0.9 : 1);

    if (!Ant._inited){
      Ant.imgBlack = new Image(); Ant.imgBlack.src = "images/enemy_black.png";
      Ant.imgGold  = new Image(); Ant.imgGold.src  = "images/enemy_golden.png";
      Ant._inited = true;
    }
  }

  update(dt, level){
    // slight speed scaling with level
    this.x += this.direction * (this.speed + level * 0.05) * (dt / 16);
  }

  draw(ctx){
    const drawImg = (img) => (img && img.complete && img.naturalWidth !== 0);
    if (this.type === "gold" && drawImg(Ant.imgGold)){
      ctx.drawImage(Ant.imgGold, this.x - this.size/2, this.y - this.size/2, this.size, this.size);
      return;
    }
    if (this.type === "normal" && drawImg(Ant.imgBlack)){
      ctx.drawImage(Ant.imgBlack, this.x - this.size/2, this.y - this.size/2, this.size, this.size);
      return;
    }

    // fallback procedural
    const s = Math.round(this.size), px = this.x, py = this.y;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const body = (this.type === "gold") ? "#ffd66b" : "#111111";
    const map = [
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [1,0,1,0,1],
      [1,0,1,0,1],
      [0,1,0,1,0]
    ];
    const block = s / 6;
    for (let r = 0; r < map.length; r++){
      for (let c = 0; c < map[0].length; c++){
        if (!map[r][c]) continue;
        const bx = px + (c - 2) * block * 1.05; const by = py + (r - 3) * block * 1.05;
        ctx.fillStyle = body; ctx.fillRect(bx, by, block, block);
      }
    }
    if (this.type === "gold"){
      ctx.globalAlpha = 0.12; ctx.fillStyle = "#ffd66b";
      ctx.beginPath(); ctx.ellipse(px, py, s * 0.9, s * 0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  isOffScreen(width){ return this.x < -80 || this.x > width + 80; }
  getRect(){ const s = this.size; return { x: this.x - s/2, y: this.y - s/2, w: s, h: s }; }
}


class Particle {
  constructor(x,y,color){
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 3.5;
    this.vy = (Math.random() - 0.9) * 3.5;
    this.life = 600 + Math.random() * 400;
    this.size = 2 + Math.random() * 3;
    this.start = Date.now();
    this.color = color;
  }
  draw(ctx){
    const t = (Date.now() - this.start) / this.life;
    if (t > 1) return;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
  update(dt){
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 0.03;
  }
}
