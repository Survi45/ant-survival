class Player{
  constructor(canvas){
    this.canvas = canvas;
    this.x = 100;
    this.y = canvas.height / 2;
    this.speed = 0.32;

    this.width = 40;
    this.height = 40;

    this.joyX = 0;
    this.joyY = 0;

    this.initJoystick();
  }

  initJoystick(){
    const base = document.getElementById("joystickBase");
    const stick = document.getElementById("joystickStick");

    let dragging = false;

    const start = (e)=>{
      dragging = true;
      this.moveStick(e, base, stick);
    };

    const move = (e)=>{
      if (!dragging) return;
      this.moveStick(e, base, stick);
    };

    const end = ()=>{
      dragging = false;
      stick.style.left = "50%";
      stick.style.top = "50%";
      this.joyX = 0;
      this.joyY = 0;
    };

    stick.addEventListener("touchstart", start, { passive:false });
    stick.addEventListener("touchmove", move, { passive:false });
    stick.addEventListener("touchend", end);

    base.addEventListener("touchstart", start, { passive:false });
    base.addEventListener("touchmove", move, { passive:false });
    base.addEventListener("touchend", end);
  }

  moveStick(e, base, stick){
    e.preventDefault();
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    const t = e.touches[0];
    let dx = t.clientX - cx;
    let dy = t.clientY - cy;

    const dist = Math.sqrt(dx*dx + dy*dy);
    const max = rect.width/2;

    if (dist > max){
      dx = dx / dist * max;
      dy = dy / dist * max;
    }

    stick.style.left = (50 + dx/max*50) + "%";
    stick.style.top = (50 + dy/max*50) + "%";

    this.joyX = dx/max;
    this.joyY = dy/max;
  }

  update(keys, dt){
    let mx = 0, my = 0;

    // Keyboard
    if (keys["ArrowUp"] || keys["w"]) my = -1;
    if (keys["ArrowDown"] || keys["s"]) my = 1;
    if (keys["ArrowLeft"] || keys["a"]) mx = -1;
    if (keys["ArrowRight"] || keys["d"]) mx = 1;

    // Joystick overrides
    if (this.joyX !== 0 || this.joyY !== 0){
      mx = this.joyX;
      my = this.joyY;
    }

    this.x += mx * this.speed * dt;
    this.y += my * this.speed * dt;

    // bounds
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;
    if (this.x + this.width > this.canvas.width)
      this.x = this.canvas.width - this.width;
    if (this.y + this.height > this.canvas.height)
      this.y = this.canvas.height - this.height;
  }

  draw(ctx){
    ctx.fillStyle = "#00eaff";
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  getRect(){
    return { x:this.x, y:this.y, w:this.width, h:this.height };
  }
}
