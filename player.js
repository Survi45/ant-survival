class Player {
  constructor(canvas){
    this.canvas = canvas;
    this.x = canvas.width * 0.12;
    this.y = canvas.height * 0.5;
    this.size = 48;
    this.speed = 3.6;
    this.facing = "right";

    this.img = new Image();
    this.img.src = "images/player.png";
    this.imgLoaded = false;

    this.img.onload = () => { 
      this.imgLoaded = true; 
    };

    this.img.onerror = () => {
      console.error("Player image failed to load.");
      this.imgLoaded = false;
    };
  }

  update(keys, dt){
    if (!this.imgLoaded) return; // prevent movement until image exists

    let moved = false;
    if (keys["ArrowUp"] || keys["w"]){ this.y -= this.speed; moved = true; }
    if (keys["ArrowDown"] || keys["s"]){ this.y += this.speed; moved = true; }
    if (keys["ArrowLeft"] || keys["a"]){ this.x -= this.speed; this.facing = "left"; moved = true; }
    if (keys["ArrowRight"] || keys["d"]){ this.x += this.speed; this.facing = "right"; moved = true; }

    const half = this.size / 2;
    this.x = Math.max(half, Math.min(this.canvas.width - half, this.x));
    this.y = Math.max(half, Math.min(this.canvas.height - half, this.y));
  }

  draw(ctx){
    if (!this.imgLoaded) return; // nothing draws → NO BLURRY PIXEL EVER

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (this.facing === "left"){
      ctx.translate(this.x, this.y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.img, -this.size/2, -this.size/2, this.size, this.size);
    } else {
      ctx.drawImage(this.img, this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    }

    ctx.restore();
  }

  getRect(){
    const s = this.size;
    return { x: this.x - s/2, y: this.y - s/2, w: s, h: s };
  }
}
