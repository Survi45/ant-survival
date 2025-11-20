class Player {
  constructor(canvas){
    this.canvas = canvas;
    this.x = canvas.width * 0.12;
    this.y = canvas.height * 0.5;
    this.size = 48;
    this.speed = 3.6;
    this.facing = "right"; // left or right

    this.img = new Image();
    this.img.src = "images/player.png";
    this.imgLoaded = false;
    this.img.onload = () => { this.imgLoaded = true; };
    this.img.onerror = () => { this.imgLoaded = false; };

    // joystick movement
    this.moveX = 0; // -1 to 1
    this.moveY = 0; // -1 to 1
  }

  update(keys, dt){
    let dx = 0, dy = 0;
    // keyboard input
    if (keys["ArrowUp"] || keys["w"]) dy -= 1;
    if (keys["ArrowDown"] || keys["s"]) dy += 1;
    if (keys["ArrowLeft"] || keys["a"]) { dx -= 1; this.facing = "left"; }
    if (keys["ArrowRight"] || keys["d"]) { dx += 1; this.facing = "right"; }

    // joystick input adds to keyboard
    dx += this.moveX;
    dy += this.moveY;

    // normalize diagonal
    if(dx!==0 && dy!==0){
      dx *= 0.7071; dy *= 0.7071;
    }

    // apply speed
    this.x += dx * this.speed;
    this.y += dy * this.speed;

    // clamp within canvas
    const half = this.size / 2;
    this.x = Math.max(half, Math.min(this.canvas.width - half, this.x));
    this.y = Math.max(half, Math.min(this.canvas.height - half, this.y));
  }

  draw(ctx){
    if (this.imgLoaded){
      ctx.save(); ctx.imageSmoothingEnabled = false;
      if (this.facing === "left"){
        ctx.translate(this.x, this.y);
        ctx.scale(-1, 1);
        ctx.drawImage(this.img, -this.size/2, -this.size/2, this.size, this.size);
      } else {
        ctx.drawImage(this.img, this.x - this.size/2, this.y - this.size/2, this.size, this.size);
      }
      ctx.restore();
      return;
    }

    // fallback procedural
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const s = this.size, px = this.x, py = this.y, block = Math.round(s / 6);
    const map = [
      [0,0,1,1,0,0],
      [0,1,1,1,1,0],
      [1,1,2,1,1,1],
      [1,3,1,1,3,1],
      [0,1,1,1,1,0],
      [0,0,1,0,0,0]
    ];

    if (this.facing === "left"){
      ctx.translate(px, py);
      ctx.scale(-1, 1);
      for (let r=0; r<map.length; r++){
        for (let c=0; c<map[0].length; c++){
          const v = map[r][c]; if(!v) continue;
          const cx = (c-3) * block * 1.02;
          const cy = (r-3) * block * 1.02;
          if (v === 1) ctx.fillStyle = "#ff7a2e";
          if (v === 2) ctx.fillStyle = "#b04d1a";
          if (v === 3) ctx.fillStyle = "#fff9f0";
          ctx.fillRect(cx, cy, block, block);
        }
      }
    } else {
      for (let r=0; r<map.length; r++){
        for (let c=0; c<map[0].length; c++){
          const v = map[r][c]; if(!v) continue;
          const cx = px + (c-3) * block * 1.02;
          const cy = py + (r-3) * block * 1.02;
          if (v === 1) ctx.fillStyle = "#ff7a2e";
          if (v === 2) ctx.fillStyle = "#b04d1a";
          if (v === 3) ctx.fillStyle = "#fff9f0";
          ctx.fillRect(cx, cy, block, block);
        }
      }
    }

    ctx.restore();
  }

  getRect(){ const s = this.size; return { x: this.x - s/2, y: this.y - s/2, w: s, h: s }; }
}
